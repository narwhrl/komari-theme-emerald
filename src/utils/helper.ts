import type { Lang } from '@/i18n'
import dayjs from 'dayjs'
import { translate } from '@/i18n'

/** 字节单位常量 */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const
const LAST_BYTE_UNIT = BYTE_UNITS.at(-1)

/** 运行时间格式化精度类型 */
export type UptimeFormat = 'day' | 'hour' | 'minute' | 'second'

export type DateTimeStyle = 'full' | 'chart' | 'time' | 'visitor'

const UPTIME_UNIT_SECONDS = [86400, 3600, 60, 1] as const
const UPTIME_UNIT_KEYS = ['uptime.days', 'uptime.hours', 'uptime.minutes', 'uptime.seconds'] as const
const UPTIME_LESS_THAN_KEYS = {
  day: 'uptime.lessThanDay',
  hour: 'uptime.lessThanHour',
  minute: 'uptime.lessThanMinute',
  second: 'uptime.lessThanSecond',
} as const
const UPTIME_FORMAT_MAX_INDEX: Record<UptimeFormat, number> = {
  day: 0,
  hour: 1,
  minute: 2,
  second: 3,
}

const DATE_TIME_OPTIONS: Record<DateTimeStyle, Intl.DateTimeFormatOptions> = {
  full: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  },
  chart: {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  },
  time: {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  },
  visitor: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  },
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

function getDateTimeFormatter(style: DateTimeStyle, lang: Lang): Intl.DateTimeFormat {
  const key = `${lang}:${style}`
  const cached = dateTimeFormatters.get(key)
  if (cached)
    return cached

  const formatter = new Intl.DateTimeFormat(lang, DATE_TIME_OPTIONS[style])
  dateTimeFormatters.set(key, formatter)
  return formatter
}

/** 字节格式化精度配置 */
export interface ByteDecimalsConfig {
  /** B 精确位数，-1 为不显示此单位 */
  B?: number
  /** KB 精确位数，-1 为不显示此单位 */
  KB?: number
  /** MB 精确位数，-1 为不显示此单位 */
  MB?: number
  /** GB 精确位数，-1 为不显示此单位 */
  GB?: number
  /** TB 及以上精确位数，-1 为不显示此单位 */
  TB?: number
}

/** 默认字节精度配置 */
const DEFAULT_BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  TB: 1,
}

/**
 * 格式化字节数为可读单位
 * @param bytes 字节数
 * @param decimals 小数位数
 * @returns 格式化后的字符串，如 "1.5 GB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0)
    return '0 B'

  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
  return `${(bytes / k ** i).toFixed(decimals)} ${unit}`
}

/**
 * 格式化字节数为可读单位（支持自定义精度配置）
 * @param bytes 字节数
 * @param config 精度配置
 * @returns 格式化后的字符串，如 "1.5 GB"
 */
export function formatBytesWithConfig(bytes: number, config?: ByteDecimalsConfig): string {
  const mergedConfig = { ...DEFAULT_BYTE_DECIMALS, ...config }

  if (bytes === 0) {
    // 0 字节时，检查 B 是否被禁用
    if (mergedConfig.B === -1)
      return '0 KB'
    return '0 B'
  }

  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  // 获取对应单位的精度配置
  const unitKey = BYTE_UNITS[i]
  // PB 及以上单位使用 TB 的精度配置
  const decimals = (unitKey === 'TB' || unitKey === 'PB') ? mergedConfig.TB : mergedConfig[unitKey as keyof ByteDecimalsConfig]

  // 如果当前单位被禁用，向上查找可用单位
  if (decimals === -1) {
    for (let j = i + 1; j < BYTE_UNITS.length; j++) {
      const nextUnitKey = BYTE_UNITS[j]
      const nextDecimals = (nextUnitKey === 'TB' || nextUnitKey === 'PB') ? mergedConfig.TB : mergedConfig[nextUnitKey as keyof ByteDecimalsConfig]
      if (nextDecimals !== -1) {
        const unit = BYTE_UNITS[j]
        return `${(bytes / k ** j).toFixed(nextDecimals)} ${unit}`
      }
    }
    // 所有单位都被禁用，使用默认行为
    const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
    return `${(bytes / k ** i).toFixed(1)} ${unit}`
  }

  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
  return `${(bytes / k ** i).toFixed(decimals)} ${unit}`
}

/**
 * 格式化字节数为分离的数值和单位（支持自定义精度配置）
 * @param bytes 字节数
 * @param config 精度配置
 * @returns 分离的数值和单位，如 { value: "1.5", unit: "GB" }
 */
export function formatBytesSplit(bytes: number, config?: ByteDecimalsConfig): { value: string, unit: string } {
  const mergedConfig = { ...DEFAULT_BYTE_DECIMALS, ...config }

  if (bytes === 0) {
    if (mergedConfig.B === -1)
      return { value: '0', unit: 'KB' }
    return { value: '0', unit: 'B' }
  }

  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const unitKey = BYTE_UNITS[i]
  const decimals = (unitKey === 'TB' || unitKey === 'PB') ? mergedConfig.TB : mergedConfig[unitKey as keyof ByteDecimalsConfig]

  if (decimals === -1) {
    for (let j = i + 1; j < BYTE_UNITS.length; j++) {
      const nextUnitKey = BYTE_UNITS[j]
      const nextDecimals = (nextUnitKey === 'TB' || nextUnitKey === 'PB') ? mergedConfig.TB : mergedConfig[nextUnitKey as keyof ByteDecimalsConfig]
      if (nextDecimals !== -1) {
        const unit = BYTE_UNITS[j]
        return { value: (bytes / k ** j).toFixed(nextDecimals), unit: `${unit}` }
      }
    }
    const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
    return { value: (bytes / k ** i).toFixed(1), unit: `${unit}` }
  }

  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
  return { value: (bytes / k ** i).toFixed(decimals), unit: `${unit}` }
}

/**
 * 格式化字节速率为分离的数值和单位（支持自定义精度配置）
 * @param bytes 字节速率
 * @param config 精度配置
 * @returns 分离的数值和单位，如 { value: "1.5", unit: "GB/s" }
 */
export function formatBytesPerSecondSplit(bytes: number, config?: ByteDecimalsConfig): { value: string, unit: string } {
  const result = formatBytesSplit(bytes, config)
  return { value: result.value, unit: `${result.unit}/s` }
}

/**
 * 格式化字节速率为可读单位
 * @param bytes 字节速率
 * @returns 格式化后的字符串，如 "1.5 GB/s"
 */
export function formatBytesPerSecond(bytes: number): string {
  return `${formatBytes(bytes)}/s`
}

/**
 * 格式化字节速率为可读单位（支持自定义精度配置）
 * @param bytes 字节速率
 * @param config 精度配置
 * @returns 格式化后的字符串，如 "1.5 GB/s"
 */
export function formatBytesPerSecondWithConfig(bytes: number, config?: ByteDecimalsConfig): string {
  return `${formatBytesWithConfig(bytes, config)}/s`
}

/**
 * 格式化运行时间（支持自定义精度）
 * @param seconds 秒数
 * @param format 精度格式：'day' | 'hour' | 'minute' | 'second'
 * @param lang 界面语言
 * @returns 格式化后的字符串
 */
export function formatUptimeWithFormat(seconds: number, format: UptimeFormat, lang: Lang): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  if (safeSeconds === 0)
    return translate(lang, 'uptime.seconds', { count: 0 })

  const maxUnitIndex = UPTIME_FORMAT_MAX_INDEX[format]
  const parts: string[] = []
  let remaining = safeSeconds

  for (let i = 0; i <= maxUnitIndex; i++) {
    const value = UPTIME_UNIT_SECONDS[i]
    const key = UPTIME_UNIT_KEYS[i]
    if (value === undefined || key === undefined)
      continue
    const amount = Math.floor(remaining / value)
    if (amount > 0) {
      parts.push(translate(lang, key, { count: amount }))
      remaining %= value
    }
  }

  if (parts.length === 0)
    return translate(lang, UPTIME_LESS_THAN_KEYS[format])

  return parts.join(' ')
}

/**
 * 计算占用百分比
 * @param used 已使用量
 * @param total 总量
 * @returns 百分比（0-100）
 */
export function calcPercentage(used: number, total: number): number {
  if (total === 0)
    return 0
  return (used / total) * 100
}

/** 状态阈值配置 */
const STATUS_THRESHOLDS = {
  success: 60,
  warning: 80,
} as const

/**
 * 根据占用百分比返回状态
 * @param percentage 百分比
 * @returns 状态类型
 */
export function getStatus(percentage: number): 'success' | 'warning' | 'error' {
  if (percentage < STATUS_THRESHOLDS.success)
    return 'success'
  if (percentage < STATUS_THRESHOLDS.warning)
    return 'warning'
  return 'error'
}

/**
 * 格式化时间戳为可读日期时间
 * @param timestamp 时间戳字符串或 Date 对象
 * @param style 闭合日期时间样式
 * @param lang 界面语言
 * @returns 格式化后的字符串；无效或缺失输入返回 "-"
 */
export function formatDateTime(
  timestamp: string | Date | undefined,
  style: DateTimeStyle,
  lang: Lang,
): string {
  if (!timestamp)
    return '-'

  const date = dayjs(timestamp)
  if (!date.isValid())
    return '-'

  return getDateTimeFormatter(style, lang).format(date.toDate())
}
