'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppDerived } from '@/stores/app'

export default function Background() {
  const derived = useAppDerived()
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const currentUrl = derived.backgroundEnabled ? derived.currentBackgroundUrl : ''
  const hasCustomBackground = derived.backgroundEnabled && Boolean(currentUrl)
  const showBackgroundOverlay = hasCustomBackground && derived.backgroundOverlay > 0
  const showLoadedBackground = hasCustomBackground && isLoaded && !hasError
  const showMediaBackground = hasCustomBackground && !hasError && (derived.backgroundType === 'video' || showLoadedBackground)
  const showDefaultBackground = !hasCustomBackground
  const showLoadingBackground = hasCustomBackground && !isLoaded && !hasError
  const showFallbackBackground = hasCustomBackground && hasError

  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)

    if (!derived.backgroundEnabled || !currentUrl)
      return undefined

    if (derived.backgroundType !== 'image')
      return undefined

    const image = new Image()
    image.onload = () => {
      setIsLoaded(true)
      setHasError(false)
    }
    image.onerror = () => {
      setIsLoaded(false)
      setHasError(true)
    }
    image.src = currentUrl

    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [currentUrl, derived.backgroundEnabled, derived.backgroundType])

  useEffect(() => {
    if (!derived.backgroundEnabled || !currentUrl) {
      videoRef.current?.pause()
      videoRef.current?.removeAttribute('src')
      videoRef.current?.load()
    }
  }, [currentUrl, derived.backgroundEnabled])

  const containerStyle = hasCustomBackground && derived.backgroundOverlay < 0
    ? { opacity: 1 - Math.abs(derived.backgroundOverlay) / 100 }
    : undefined
  const backgroundStyle = {
    filter: derived.backgroundBlur > 0 ? `blur(${derived.backgroundBlur}px)` : 'none',
    opacity: derived.backgroundType === 'video' && !isLoaded ? 0 : 1,
  }
  const overlayStyle = derived.backgroundOverlay > 0
    ? { backgroundColor: `rgba(0, 0, 0, ${derived.backgroundOverlay / 100})` }
    : undefined

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={containerStyle}>
      {showDefaultBackground
        ? (
            <div className="absolute inset-0 mx-0 max-w-none overflow-hidden zoom-150 bg-slate-50 dark:bg-slate-900/50">
              <div className="absolute top-0 left-1/2 -ml-152 h-100 w-325 dark:mask-[linear-gradient(white,transparent)]">
                <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-lime-300 opacity-40 mask-[radial-gradient(farthest-side_at_top,white,transparent)] dark:from-emerald-500/30 dark:to-lime-300/30 dark:opacity-100">
                  <svg
                    aria-hidden="true"
                    className="absolute inset-x-0 inset-y-[-50%] h-[200%] w-full skew-y-[-18deg] fill-black/40 stroke-black/50 mix-blend-overlay dark:fill-white/2.5 dark:stroke-white/5"
                  >
                    <defs>
                      <pattern id="_S_1_" width="72" height="56" patternUnits="userSpaceOnUse" x="-12" y="4">
                        <path d="M.5 56V.5H72" fill="none" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" strokeWidth="0" fill="url(#_S_1_)" />
                    <svg x="-12" y="4" className="overflow-visible">
                      <rect strokeWidth="0" width="73" height="57" x="288" y="168" />
                      <rect strokeWidth="0" width="73" height="57" x="144" y="56" />
                      <rect strokeWidth="0" width="73" height="57" x="504" y="168" />
                      <rect strokeWidth="0" width="73" height="57" x="720" y="336" />
                    </svg>
                  </svg>
                </div>
              </div>
            </div>
          )
        : null}
      {showLoadingBackground || showFallbackBackground ? <div className="absolute inset-0 bg-background" /> : null}
      {showMediaBackground
        ? (
            <div className="absolute inset-0 scale-110 transition-opacity duration-700" style={backgroundStyle}>
              {derived.backgroundType === 'image'
                ? (
                    <div
                      className="h-full w-full bg-cover bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${currentUrl})` }}
                    />
                  )
                : (
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      src={currentUrl}
                      autoPlay
                      loop
                      muted
                      preload="auto"
                      playsInline
                      onLoadedData={() => {
                        setIsLoaded(true)
                        setHasError(false)
                      }}
                      onCanPlay={() => {
                        setIsLoaded(true)
                        setHasError(false)
                      }}
                      onError={() => {
                        setIsLoaded(false)
                        setHasError(true)
                      }}
                    />
                  )}
            </div>
          )
        : null}
      {showBackgroundOverlay ? <div className="pointer-events-none absolute inset-0" style={overlayStyle} /> : null}
    </div>
  )
}
