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
            <div className="absolute inset-0 mx-0 max-w-none overflow-hidden bg-background">
              <div className="absolute inset-0 opacity-[0.55] dark:opacity-[0.32]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-border)_70%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-border)_70%,transparent)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
              </div>
              <div className="absolute top-0 left-1/2 -ml-152 h-86 w-325 opacity-70 dark:opacity-60">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-muted)_68%,transparent),transparent_68%)]">
                  <svg
                    aria-hidden="true"
                    className="absolute inset-x-0 inset-y-[-50%] h-[200%] w-full skew-y-[-18deg] fill-black/[0.03] stroke-black/[0.06] dark:fill-white/[0.03] dark:stroke-white/[0.06]"
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
            <div className="absolute inset-0 scale-110 transition-opacity duration-300 ease-out" style={backgroundStyle}>
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
