"use client";

import { useMemo } from "react";
import { formatBytes } from "@/utils/helper";
import { cn } from "@/lib/utils";

export interface TrafficProgressProps {
  upload: number;
  download: number;
  trafficLimit: number;
  trafficLimitType: "up" | "down" | "min" | "max" | "sum";
  uploadColor?: string;
  downloadColor?: string;
  singleColor?: string;
  height?: number | string;
  showIndicator?: boolean;
  className?: string;
}

export function TrafficProgress({
  upload,
  download,
  trafficLimit,
  trafficLimitType,
  height,
  showIndicator = false,
  className,
}: TrafficProgressProps) {
  const showProgress = trafficLimit > 0;
  const usedTraffic = useMemo(() => {
    switch (trafficLimitType) {
      case "up":
        return upload;
      case "down":
        return download;
      case "min":
        return Math.min(upload, download);
      case "max":
        return Math.max(upload, download);
      case "sum":
      default:
        return upload + download;
    }
  }, [upload, download, trafficLimitType]);

  const totalPercentage = showProgress ? Math.min((usedTraffic / trafficLimit) * 100, 100) : 0;
  const uploadPercentage = showProgress ? Math.min((upload / trafficLimit) * 100, 100) : 0;
  const downloadPercentage = showProgress ? Math.min((download / trafficLimit) * 100, 100) : 0;
  const isDualColorMode = trafficLimitType === "sum";
  const progressHeight =
    height === undefined
      ? undefined
      : typeof height === "number"
        ? `${height}px`
        : height;

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      <div
        className="relative flex overflow-hidden h-2 rounded-[5px] bg-muted transition-colors"
        style={progressHeight ? { height: progressHeight } : undefined}
      >
        {isDualColorMode ? (
          <>
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${uploadPercentage}%` }}
            />
            <div
              className="h-full bg-blue-600 rounded-r-[5px] transition-all"
              style={{ width: `${downloadPercentage}%` }}
            />
          </>
        ) : (
          <div
            className="h-full bg-green-600 rounded-r-[5px] transition-all"
            style={{ width: `${totalPercentage}%` }}
          />
        )}
      </div>
      {showIndicator && showProgress && (
        <div className="flex justify-between items-center text-xs text-foreground/80">
          <span>{totalPercentage.toFixed(1)}%</span>
          <span className="text-muted-foreground">
            {formatBytes(usedTraffic)} / {formatBytes(trafficLimit)}
          </span>
        </div>
      )}
    </div>
  );
}

export default TrafficProgress;