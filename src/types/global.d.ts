import type { message } from '@/utils/message'

declare global {
  interface Window {
    $message?: typeof message
  }
}

export {}
