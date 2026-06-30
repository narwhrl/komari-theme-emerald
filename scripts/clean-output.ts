import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')

for (const dir of ['dist', 'out']) {
  rmSync(resolve(rootDir, dir), { force: true, recursive: true })
}
