import { execSync } from 'node:child_process'
import { cpSync, createWriteStream, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import archiver from 'archiver'
import { restoreNextGeneratedFiles } from './next-generated'

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  }
  catch {
    return 'unknown'
  }
}

async function buildThemeZip(): Promise<void> {
  const commitHash = getCommitHash()
  const zipFileName = `komari-theme-emerald-build-${commitHash}.zip`
  const rootDir = resolve(import.meta.dirname, '..')
  const exportDir = resolve(rootDir, 'out')
  const distDir = resolve(rootDir, 'dist')
  const themeJsonPath = resolve(rootDir, 'komari-theme.json')
  const previewPath = resolve(rootDir, 'docs/preview.png')
  const outputPath = resolve(rootDir, zipFileName)

  if (!existsSync(exportDir)) {
    throw new Error('[komari-theme-zip] Next export directory not found: out')
  }

  rmSync(distDir, { force: true, recursive: true })
  cpSync(exportDir, distDir, { recursive: true })
  rmSync(exportDir, { force: true, recursive: true })

  const output = createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  await new Promise<void>((resolvePromise, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      console.log(`[komari-theme-zip] Created ${zipFileName} (${sizeMB} MB)`)
      resolvePromise()
    })

    archive.on('error', (err: Error) => {
      console.error('[komari-theme-zip] Error:', err)
      reject(err)
    })

    archive.pipe(output)

    if (existsSync(themeJsonPath))
      archive.file(themeJsonPath, { name: 'komari-theme.json' })

    if (existsSync(previewPath))
      archive.file(previewPath, { name: 'preview.png' })

    archive.directory(distDir, 'dist')
    archive.finalize()
  })
}

try {
  await buildThemeZip()
}
finally {
  restoreNextGeneratedFiles()
}
