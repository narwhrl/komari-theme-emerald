declare module 'archiver' {
  import type { Writable } from 'node:stream'

  interface Archiver {
    pipe: (stream: Writable) => void
    file: (path: string, data: { name: string }) => void
    directory: (path: string, destination: string) => void
    finalize: () => void
    pointer: () => number
    on: (event: 'error', listener: (error: Error) => void) => this
  }

  export default function archiver(format: 'zip', options?: { zlib?: { level?: number } }): Archiver
}
