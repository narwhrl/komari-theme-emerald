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
              <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_85%_70%_at_50%_0%,color-mix(in_oklab,var(--color-muted)_72%,transparent),transparent_72%)] opacity-90 dark:opacity-60" />
              <div className="absolute top-0 -inset-x-[12vw] h-[560px] opacity-70 [mask-image:linear-gradient(to_right,transparent_0%,black_12%,black_78%,transparent_100%)] dark:opacity-60">
                <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)]">
                  <svg
                    aria-hidden="true"
                    className="absolute top-[-235px] left-1/2 h-[760px] w-[min(1800px,140vw)] -translate-x-1/2 skew-y-[-18deg] fill-black/[0.03] stroke-black/[0.06] dark:fill-white/[0.03] dark:stroke-white/[0.06]"
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
              <div className="pointer-events-none absolute top-0 right-0 h-[560px] w-[36vw] bg-[linear-gradient(to_left,var(--color-background)_0%,color-mix(in_oklab,var(--color-background)_72%,transparent)_46%,transparent_100%)]" />
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
