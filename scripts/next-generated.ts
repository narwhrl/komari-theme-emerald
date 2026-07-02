import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')
const nextEnvPath = resolve(rootDir, 'next-env.d.ts')
const tsconfigPath = resolve(rootDir, 'tsconfig.json')

const stableNextEnv = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`

const stableNextIncludes = [
  'next-env.d.ts',
  '**/*.ts',
  '**/*.tsx',
  '.next/types/**/*.ts',
  '.next/dev/types/**/*.ts',
]

export function restoreNextGeneratedFiles(): void {
  writeFileSync(nextEnvPath, stableNextEnv)

  const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as { include?: unknown }
  tsconfig.include = stableNextIncludes
  writeFileSync(`${tsconfigPath}`, `${JSON.stringify(tsconfig, null, 2)}\n`)
}
