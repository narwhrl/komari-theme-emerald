import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { restoreNextGeneratedFiles } from './next-generated'

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

try {
  run('next', ['typegen'])
  run('tsc', ['--noEmit'])
}
finally {
  restoreNextGeneratedFiles()
}
