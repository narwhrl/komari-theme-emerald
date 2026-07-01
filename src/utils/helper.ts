import dayjs from "dayjs";

/**
 * Byte formatting helpers
 */
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
const LAST_BYTE_UNIT = BYTE_UNITS.at(-1);

const TIME_UNITS = [
  { value: 86400, label: "天" },
  { value: 3600, label: "小时" },
  { value: 60, label: "分钟" },
  { value: 1, label: "秒" },
] as const;

export type UptimeFormat = "day" | "hour" | "minute" | "second";

export interface ByteDecimalsConfig {
  B?: number;
  KB?: number;
  MB?: number;
  GB?: number;
  TB?: number;
}

const DEFAULT_BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 2,
};

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT;
  return `${(bytes / k ** i).toFixed(decimals)} ${unit}`;
}

export function formatBytesWithConfig(
  bytes: number,
  config?: ByteDecimalsConfig,
): string {
  const mergedConfig = { ...DEFAULT_BYTE_DECIMALS, ...config };
  if (bytes === 0) {
    if (mergedConfig.B === -1) return "0 KB";
    return "0 B";
  }
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitKey = BYTE_UNITS[i];
  const decimals =
    unitKey === "TB" || unitKey === "PB"
      ? mergedConfig.TB
      : mergedConfig[unitKey as keyof ByteDecimalsConfig];

  if (decimals === -1) {
    for (let j = i + 1; j < BYTE_UNITS.length; j++) {
      const nextUnitKey = BYTE_UNITS[j];
      const nextDecimals =
        nextUnitKey === "TB" || nextUnitKey === "PB"
          ? mergedConfig.TB
          : mergedConfig[nextUnitKey as keyof ByteDecimalsConfig];
      if (nextDecimals !== -1) {
        const unit = BYTE_UNITS[j];
        return `${(bytes / k ** j).toFixed(nextDecimals)} ${unit}`;
      }
    }
    const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT;
    return `${(bytes / k ** i).toFixed(1)} ${unit}`;
  }

  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT;
  return `${(bytes / k ** i).toFixed(decimals)} ${unit}`;
}

export function formatBytesSplit(
  bytes: number,
  config?: ByteDecimalsConfig,
): { value: string; unit: string } {
  const mergedConfig = { ...DEFAULT_BYTE_DECIMALS, ...config };
  if (bytes === 0) {
    if (mergedConfig.B === -1) return { value: "0", unit: "KB" };
    return { value: "0", unit: "B" };
  }
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitKey = BYTE_UNITS[i];
  const decimals =
    unitKey === "TB" || unitKey === "PB"
      ? mergedConfig.TB
      : mergedConfig[unitKey as keyof ByteDecimalsConfig];

  if (decimals === -1) {
    for (let j = i + 1; j < BYTE_UNITS.length; j++) {
      const nextUnitKey = BYTE_UNITS[j];
      const nextDecimals =
        nextUnitKey === "TB" || nextUnitKey === "PB"
          ? mergedConfig.TB
          : mergedConfig[nextUnitKey as keyof ByteDecimalsConfig];
      if (nextDecimals !== -1) {
        const unit = BYTE_UNITS[j];
        return {
          value: (bytes / k ** j).toFixed(nextDecimals),
          unit: `${unit}`,
        };
      }
    }
    const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT;
    return { value: (bytes / k ** i).toFixed(1), unit: `${unit}` };
  }
  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT;
  return { value: (bytes / k ** i).toFixed(decimals), unit: `${unit}` };
}

export function formatBytesPerSecondSplit(
  bytes: number,
  config?: ByteDecimalsConfig,
): { value: string; unit: string } {
  const result = formatBytesSplit(bytes, config);
  return { value: result.value, unit: `${result.unit}/s` };
}

export function formatBytesPerSecond(bytes: number): string {
  return `${formatBytes(bytes)}/s`;
}

export function formatBytesPerSecondWithConfig(
  bytes: number,
  config?: ByteDecimalsConfig,
): string {
  return `${formatBytesWithConfig(bytes, config)}/s`;
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 秒";
  const parts: string[] = [];
  let remaining = seconds;
  for (const { value, label } of TIME_UNITS) {
    const amount = Math.floor(remaining / value);
    if (amount > 0) {
      parts.push(`${amount} ${label}`);
      remaining %= value;
    }
  }
  return parts.length > 0 ? parts.join(" ") : "0 秒";
}

export function formatUptimeWithFormat(
  seconds: number,
  format: UptimeFormat = "day",
): string {
  if (!seconds || seconds <= 0) return "0 秒";
  const formatMaxUnitIndexMap: Record<UptimeFormat, number> = {
    day: 0,
    hour: 1,
    minute: 2,
    second: 3,
  };
  const maxUnitIndex = formatMaxUnitIndexMap[format];
  const parts: string[] = [];
  let remaining = seconds;
  for (let i = 0; i < TIME_UNITS.length; i++) {
    const unit = TIME_UNITS[i];
    if (!unit) continue;
    const { value, label } = unit;
    const amount = Math.floor(remaining / value);
    if (amount > 0) {
      parts.push(`${amount} ${label}`);
      remaining %= value;
    }
    if (i >= maxUnitIndex) break;
  }
  if (parts.length === 0) {
    const fallbackUnit = TIME_UNITS[maxUnitIndex];
    const fallbackLabel = fallbackUnit?.label ?? "秒";
    return `不足 1 ${fallbackLabel}`;
  }
  return parts.join(" ");
}

export function calcPercentage(used: number, total: number): number {
  if (total === 0) return 0;
  return (used / total) * 100;
}

const STATUS_THRESHOLDS = {
  success: 60,
  warning: 80,
} as const;

export function getStatus(
  percentage: number,
): "success" | "warning" | "error" {
  if (percentage < STATUS_THRESHOLDS.success) return "success";
  if (percentage < STATUS_THRESHOLDS.warning) return "warning";
  return "error";
}

export function formatDateTime(
  timestamp: string | Date | undefined,
  format = "YYYY-MM-DD HH:mm:ss",
): string {
  if (!timestamp) return "-";
  const date = dayjs(timestamp);
  if (!date.isValid()) return "-";
  return date.format(format);
}