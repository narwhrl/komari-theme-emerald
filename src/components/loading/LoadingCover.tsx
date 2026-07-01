"use client";

interface LoadingCoverProps {
  visible?: boolean;
}

/**
 * Full-screen blocking loading state shown during the initial app
 * bootstrap. Once the data layer is ready the cover fades out via
 * its own visibility prop.
 */
export function LoadingCover({ visible = true }: LoadingCoverProps) {
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="正在初始化应用"
      className="loading-cover fixed inset-0 z-20 flex items-center justify-center backdrop-blur-sm bg-white/80 dark:bg-black/50"
    >
      <div className="flex flex-col items-center gap-3 text-foreground">
        <span
          className="inline-block size-7 animate-spin rounded-full border-2"
          style={{
            borderColor: "color-mix(in srgb, currentColor 18%, transparent)",
            borderTopColor: "currentColor",
          }}
          aria-hidden="true"
        />
        <span className="text-sm text-muted-foreground">正在加载…</span>
      </div>
    </div>
  );
}

export default LoadingCover;