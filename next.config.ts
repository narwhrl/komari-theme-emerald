import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'
import process from 'node:process'
import packageJson from './package.json' with { type: 'json' }

const CLOUDFLARE_PAGES_GITHUB_FALLBACK = 'https://github.com/narwhrl/komari-theme-emerald'
const GITHUB_REPOSITORY_SEGMENT = /^[A-Z0-9][\w.-]*$/i
const GITHUB_REPOSITORY_VALUE = /^(?:https:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)$/i
const GITHUB_GIT_REMOTE = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)?([^/\s]+)\/([^/\s]+)$/i
const TRAILING_SLASHES = /\/+$/
const GIT_SUFFIX = /\.git$/i

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  }
  catch {
    return 'unknown'
  }
}

function getOriginUrl(): string {
  try {
    return execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim()
  }
  catch {
    return ''
  }
}

function toGithubRepositoryUrl(value: string, allowGitRemote: boolean): string | undefined {
  const normalized = value.trim().replace(TRAILING_SLASHES, '')
  const match = normalized.match(allowGitRemote ? GITHUB_GIT_REMOTE : GITHUB_REPOSITORY_VALUE)

  if (!match)
    return undefined

  const [, owner, repositoryWithSuffix] = match
  const repository = repositoryWithSuffix.replace(GIT_SUFFIX, '')
  if (!GITHUB_REPOSITORY_SEGMENT.test(owner) || !GITHUB_REPOSITORY_SEGMENT.test(repository))
    return undefined

  return `https://github.com/${owner}/${repository}`
}

function getGithubRepositoryUrl(): string {
  return toGithubRepositoryUrl(getOriginUrl(), true)
    ?? toGithubRepositoryUrl(process.env.NEXT_PUBLIC_GITHUB_REPOSITORY ?? '', false)
    ?? CLOUDFLARE_PAGES_GITHUB_FALLBACK
}

const isCloudflarePages = process.env.CF_PAGES === '1'

const nextConfig: NextConfig = {
  output: 'export',
  turbopack: {
    root: import.meta.dirname,
  },
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_GIT_HASH: getCommitHash(),
    NEXT_PUBLIC_IS_CLOUDFLARE_PAGES: String(isCloudflarePages),
    NEXT_PUBLIC_GITHUB_REPOSITORY_URL: isCloudflarePages ? getGithubRepositoryUrl() : '',
  },
}

export default nextConfig
