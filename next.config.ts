import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'
import packageJson from './package.json' with { type: 'json' }

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  }
  catch {
    return 'unknown'
  }
}

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
  },
}

export default nextConfig
