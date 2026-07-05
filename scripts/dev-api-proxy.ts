import type { Buffer } from 'node:buffer'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { once } from 'node:events'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { connect as netConnect } from 'node:net'
import { connect as tlsConnect } from 'node:tls'

export interface DevApiProxy {
  apiBase: string
  close: () => void
  origin: string
  server: Server
  target: URL
}

const DEFAULT_PROXY_HOST = '127.0.0.1'
const HTTP_PORT = 80
const HTTPS_PORT = 443
const HTTP_PROTOCOL_RE = /^https?:\/\//
const TRAILING_SLASH_RE = /\/$/

function normalizeTarget(target: string): URL {
  const trimmedTarget = target.trim()
  if (!trimmedTarget)
    throw new Error('Missing Komari backend target')

  const withProtocol = HTTP_PROTOCOL_RE.test(trimmedTarget)
    ? trimmedTarget
    : `https://${trimmedTarget}`

  const url = new URL(withProtocol)
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error(`Unsupported backend protocol: ${url.protocol}`)

  return url
}

function getCorsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin || '*'
  const requestHeaders = request.headers['access-control-request-headers']

  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': Array.isArray(requestHeaders) ? requestHeaders.join(', ') : requestHeaders || 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
  }
}

function getProxyResponseHeaders(request: IncomingMessage, upstreamHeaders: IncomingMessage['headers']): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {}

  for (const [key, value] of Object.entries(upstreamHeaders)) {
    const normalizedKey = key.toLowerCase()
    if (typeof value === 'undefined' || normalizedKey.startsWith('access-control-') || normalizedKey === 'vary')
      continue
    headers[key] = value
  }

  return {
    ...headers,
    ...getCorsHeaders(request),
  }
}

function resolveTargetUrl(target: URL, requestUrl?: string): URL | null {
  const localUrl = new URL(requestUrl || '/', 'http://localhost')
  if (!localUrl.pathname.startsWith('/api'))
    return null

  const targetUrl = new URL(target.href)
  const basePath = target.pathname.replace(TRAILING_SLASH_RE, '')
  const requestPath = basePath.endsWith('/api') && localUrl.pathname.startsWith('/api/')
    ? localUrl.pathname.slice('/api'.length)
    : localUrl.pathname

  targetUrl.pathname = `${basePath}${requestPath}` || '/'
  targetUrl.search = localUrl.search
  return targetUrl
}

function writeError(response: ServerResponse, request: IncomingMessage, status: number, message: string): void {
  if (response.headersSent)
    return

  response.writeHead(status, {
    ...getCorsHeaders(request),
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify({ message, status: 'error' }))
}

function proxyHttpRequest(target: URL, request: IncomingMessage, response: ServerResponse): void {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, getCorsHeaders(request))
    response.end()
    return
  }

  const targetUrl = resolveTargetUrl(target, request.url)
  if (!targetUrl) {
    writeError(response, request, 404, 'Not found')
    return
  }

  const requestHeaders = {
    ...request.headers,
    host: targetUrl.host,
    origin: target.origin,
    referer: `${target.origin}/`,
  }
  delete requestHeaders.connection

  const upstreamRequest = (targetUrl.protocol === 'https:' ? httpsRequest : httpRequest)(targetUrl, {
    headers: requestHeaders,
    method: request.method,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, getProxyResponseHeaders(request, upstreamResponse.headers))
    upstreamResponse.pipe(response)
  })

  upstreamRequest.on('error', (error) => {
    writeError(response, request, 502, error instanceof Error ? error.message : String(error))
  })

  request.pipe(upstreamRequest)
}

function endSocket(socket: Duplex, status: number, message: string): void {
  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`)
}

function proxyWebSocketUpgrade(target: URL, request: IncomingMessage, socket: Duplex, head: Buffer): void {
  const targetUrl = resolveTargetUrl(target, request.url)
  if (!targetUrl) {
    endSocket(socket, 404, 'Not Found')
    return
  }

  const isSecure = targetUrl.protocol === 'https:'
  const port = Number(targetUrl.port || (isSecure ? HTTPS_PORT : HTTP_PORT))
  let upstream: Duplex | null = null

  const writeUpgradeRequest = () => {
    if (!upstream) {
      socket.destroy()
      return
    }

    const headers = {
      ...request.headers,
      host: targetUrl.host,
      origin: target.origin,
    }
    const path = `${targetUrl.pathname}${targetUrl.search}`
    const headerLines = Object.entries(headers)
      .flatMap(([key, value]) => Array.isArray(value) ? value.map(item => [key, item]) : [[key, value]])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => `${key}: ${value}`)

    upstream.write(`GET ${path} HTTP/${request.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`)
    if (head.length)
      upstream.write(head)

    socket.pipe(upstream)
    upstream.pipe(socket)
  }

  upstream = isSecure
    ? tlsConnect({ host: targetUrl.hostname, port, servername: targetUrl.hostname }, writeUpgradeRequest)
    : netConnect({ host: targetUrl.hostname, port }, writeUpgradeRequest)

  upstream.once('error', () => {
    socket.destroy()
  })

  socket.once('error', () => {
    upstream?.destroy()
  })
}

export async function startDevApiProxy(target: string): Promise<DevApiProxy> {
  const targetUrl = normalizeTarget(target)
  const server = createServer((request, response) => proxyHttpRequest(targetUrl, request, response))

  server.on('upgrade', (request, socket, head) => {
    proxyWebSocketUpgrade(targetUrl, request, socket, head)
  })

  server.listen(0, DEFAULT_PROXY_HOST)
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Unable to resolve dev API proxy address')

  const origin = `http://${DEFAULT_PROXY_HOST}:${address.port}`
  return {
    apiBase: `${origin}/api`,
    close: () => server.close(),
    origin,
    server,
    target: targetUrl,
  }
}
