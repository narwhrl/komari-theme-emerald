"use client";

import { cn } from "@/lib/utils";

type Status = "success" | "warning" | "error";

const STATUS_COLOR: Record<Status, string> = {
  success: "bg-emerald-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

interface ProgressThinProps {
  percentage: number;
  status?: Status;
  height?: number;
  className?: string;
}

export function ProgressThin({
  percentage,
  status = "success",
  height = 4,
  className,
}: ProgressThinProps) {
  const pct = Math.max(0, Math.min(100, percentage));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", STATUS_COLOR[status])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default ProgressThin;