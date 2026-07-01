/**
 * Global TypeScript declarations.
 * Includes window globals and build-time constants.
 */

import type { MessageInstance } from "@/utils/message";

declare global {
  interface Window {
    /** Global toast/notification helper exposed by message util. */
    $message: MessageInstance;
  }

  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_BASE?: string;
    }
  }
}

export {};