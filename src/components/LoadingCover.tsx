'use client'

import { useAppDerived } from '@/stores/app'

export default function LoadingCover() {
  const { isDark } = useAppDerived()

  return (
    <div className={`fixed inset-0 z-20 flex items-center justify-center backdrop-blur-sm ${isDark ? 'bg-black/50' : 'bg-white/80'}`}>
      <div className="flex flex-col items-center gap-3 text-foreground">
        <span
          className="inline-block size-7 animate-spin rounded-full border-2"
          style={{
            borderColor: 'color-mix(in srgb, currentColor 18%, transparent)',
            borderTopColor: 'currentColor',
          }}
        />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  )
}
