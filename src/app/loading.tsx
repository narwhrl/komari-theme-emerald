/**
 * Top-level loading state. Shown automatically by Next.js while the
 * route segment is loading (Suspense boundary, dynamic import, etc.).
 * Mirrors the structure of `app/page.tsx` so the layout doesn't shift
 * when content swaps in.
 */
import { Icon } from "@iconify/react";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="正在加载"
      className="flex flex-col gap-4 p-4"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="tabler:loader-2" className="animate-spin" width={16} height={16} aria-hidden="true" />
        正在加载…
      </div>

      {/* Skeleton: matches the top summary cards row. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-md bg-muted/40 animate-pulse"
          />
        ))}
      </div>

      {/* Skeleton: matches the tabs + node-card grid area. */}
      <div className="h-8 w-64 rounded-md bg-muted/40 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-md bg-muted/30 animate-pulse"
          />
        ))}
      </div>

      <span className="sr-only">正在加载节点列表</span>
    </div>
  );
}