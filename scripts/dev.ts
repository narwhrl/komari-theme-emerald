import { spawn } from 'node:child_process'
import process from 'node:process'
import { startDevApiProxy } from './dev-api-proxy'
import { restoreNextGeneratedFiles } from './next-generated'

function readDevOptions(args: string[]): { backendTarget?: string, nextArgs: string[] } {
  const nextArgs = ['dev']
  let backendTarget = process.env.KOMARI_DEV_API_TARGET

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--backend') {
      backendTarget = args[index + 1]
      index += 1
    }
    else if (arg.startsWith('--backend=')) {
      backendTarget = arg.slice('--backend='.length)
    }
    else if (arg === '--no-backend') {
      backendTarget = undefined
    }
    else {
      nextArgs.push(arg)
    }
  }

  return { backendTarget, nextArgs }
}

const { backendTarget, nextArgs } = readDevOptions(process.argv.slice(2))
const proxy = backendTarget ? await startDevApiProxy(backendTarget) : null
const env = { ...process.env }

if (proxy) {
  env.NEXT_PUBLIC_API_BASE = proxy.apiBase
  env.NEXT_PUBLIC_RPC_TRANSPORT_MODE = env.NEXT_PUBLIC_RPC_TRANSPORT_MODE || 'http'
  console.log(`[dev-api-proxy] ${proxy.apiBase} -> ${proxy.target.origin}${proxy.target.pathname === '/' ? '' : proxy.target.pathname}`)
  console.log(`[dev-api-proxy] rpc transport: ${env.NEXT_PUBLIC_RPC_TRANSPORT_MODE}`)
}

const child = spawn('next', nextArgs, {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

let isShuttingDown = false

function shutdown(exitCode = 0): never {
  if (isShuttingDown)
    process.exit(exitCode)

  isShuttingDown = true
  proxy?.close()
  restoreNextGeneratedFiles()
  process.exit(exitCode)
}

process.on('SIGINT', () => {
  child.kill('SIGINT')
})

process.on('SIGTERM', () => {
  child.kill('SIGTERM')
})

child.on('exit', (code, signal) => {
  shutdown(code ?? (signal ? 1 : 0))
})

child.on('error', (error) => {
  console.error(error)
  shutdown(1)
})
