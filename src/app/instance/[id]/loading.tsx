/**
 * Per-route loading for /instance/[id]. Shows while the route segment
 * (and its dynamic chart imports) is being prepared.
 */
import { Icon } from "@iconify/react";

export default function InstanceLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="正在加载节点详情"
      className="flex flex-col gap-4 p-4"
    >
      {/* Header bar */}
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-muted/40 animate-pulse" />
        <div className="h-6 w-40 rounded-md bg-muted/40 animate-pulse" />
        <div className="h-5 w-12 rounded-md bg-muted/40 animate-pulse" />
      </div>

      {/* 4 metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-md bg-muted/30 animate-pulse"
          />
        ))}
      </div>

      {/* 4 info cards (2x2 grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-md bg-muted/30 animate-pulse"
          />
        ))}
      </div>

      {/* Two charts (LoadChart + PingChart) */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="tabler:loader-2" className="animate-spin" width={16} height={16} aria-hidden="true" />
        正在加载历史图表…
      </div>
      <div className="h-64 rounded-md bg-muted/20 animate-pulse" />
      <div className="h-48 rounded-md bg-muted/20 animate-pulse" />

      <span className="sr-only">正在加载节点详情页</span>
    </div>
  );
}