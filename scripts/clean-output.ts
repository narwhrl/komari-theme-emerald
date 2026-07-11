import { readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')
const themeBuildZipPattern = /^komari-theme-emerald-build-[^/]+\.zip$/

for (const dir of ['dist', 'out']) {
  rmSync(resolve(rootDir, dir), { force: true, recursive: true })
}

for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
  if (entry.isFile() && themeBuildZipPattern.test(entry.name))
    rmSync(resolve(rootDir, entry.name), { force: true })
}
