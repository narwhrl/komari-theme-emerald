"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/app";
import { useThemeMode } from "@/hooks/useThemeMode";

/**
 * Background — renders the default gradient/pattern background, or the
 * custom image/video background configured via theme settings.
 */
export function Background() {
  const backgroundEnabled = useAppStore((s) => s.getBackgroundEnabled());
  const backgroundType = useAppStore((s) => s.getBackgroundType());
  const backgroundBlur = useAppStore((s) => s.getBackgroundBlur());
  const backgroundOverlay = useAppStore((s) => s.getBackgroundOverlay());
  const { resolved } = useThemeMode();
  const currentUrl = useAppStore((s) => s.getCurrentBackgroundUrl(resolved));

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const hasCustomBackground = backgroundEnabled && !!currentUrl;

  // Reset state when URL/type changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    if (backgroundType === "image" && currentUrl && typeof window !== "undefined") {
      const img = new window.Image();
      img.onload = () => setIsLoaded(true);
      img.onerror = () => setHasError(true);
      img.src = currentUrl;
    }
  }, [currentUrl, backgroundType]);

  useEffect(() => {
    const el = videoRef.current;
    return () => {
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    };
  }, []);

  const containerStyle: React.CSSProperties =
    hasCustomBackground && backgroundOverlay < 0
      ? { opacity: 1 - Math.abs(backgroundOverlay) / 100 }
      : {};
  const mediaStyle: React.CSSProperties = {
    filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : "none",
    opacity: backgroundType === "video" && !isLoaded ? 0 : 1,
  };
  const overlayStyle: React.CSSProperties =
    backgroundOverlay > 0
      ? { backgroundColor: `rgba(0, 0, 0, ${backgroundOverlay / 100})` }
      : {};

  const showDefault = !hasCustomBackground;
  const showLoading = hasCustomBackground && !isLoaded && !hasError;
  const showFallback = hasCustomBackground && hasError;
  const showMedia =
    hasCustomBackground && !hasError && (backgroundType === "video" || isLoaded);

  return (
    <div
      className="background-container fixed inset-0 -z-1 overflow-hidden"
      style={containerStyle}
    >
      {showDefault && (
        <div className="absolute inset-0 mx-0 max-w-none overflow-hidden zoom-150 bg-slate-50 dark:bg-slate-900/50">
          <div className="absolute top-0 left-1/2 -ml-152 h-100 w-325 dark:mask-[linear-gradient(white,transparent)]">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-lime-300 mask-[radial-gradient(farthest-side_at_top,white,transparent)] opacity-40 dark:from-emerald-500/30 dark:to-lime-300/30 dark:opacity-100">
              <svg
                aria-hidden="true"
                className="absolute inset-x-0 inset-y-[-50%] h-[200%] w-full skew-y-[-18deg] fill-black/40 stroke-black/50 mix-blend-overlay dark:fill-white/2.5 dark:stroke-white/5"
              >
                <defs>
                  <pattern
                    id="bg-pattern"
                    width="72"
                    height="56"
                    patternUnits="userSpaceOnUse"
                    x="-12"
                    y="4"
                  >
                    <path d="M.5 56V.5H72" fill="none" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" strokeWidth="0" fill="url(#bg-pattern)" />
              </svg>
            </div>
          </div>
        </div>
      )}
      {showLoading && <div className="absolute inset-0 bg-background" />}
      {showFallback && <div className="absolute inset-0 bg-background" />}
      {showMedia && (
        <div
          className="background-media absolute inset-0 scale-110 transition-opacity duration-700"
          style={mediaStyle}
        >
          {backgroundType === "image" ? (
            <div
              className="background-image w-full h-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${currentUrl})` }}
            />
          ) : (
            <video
              ref={videoRef}
              className="background-video w-full h-full object-cover"
              src={currentUrl}
              autoPlay
              loop
              muted
              preload="auto"
              playsInline
              onLoadedData={() => {
                setIsLoaded(true);
                setHasError(false);
              }}
              onCanPlay={() => {
                setIsLoaded(true);
                setHasError(false);
              }}
              onError={() => {
                setIsLoaded(false);
                setHasError(true);
              }}
            />
          )}
        </div>
      )}
      {hasCustomBackground && backgroundOverlay > 0 && (
        <div
          className="background-overlay absolute inset-0 pointer-events-none"
          style={overlayStyle}
        />
      )}
    </div>
  );
}

export default Background;