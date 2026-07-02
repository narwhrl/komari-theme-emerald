'use client'

import { useMemo } from 'react'
import { NODE_PING_BAR_COUNT, useNodePingStats } from '@/composables/useNodePingStats'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/helper'

export type NodePingMetric = 'latency' | 'loss'

export interface NodePingBar {
  key: string
  className: string
  tooltip: string
}

interface UseNodePingDisplayOptions {
  enabled?: boolean
  loadingDisplayText?: string
  emptyDisplayText?: string
  loadingPanelTooltipText?: Partial<Record<NodePingMetric, string>>
  emptyPanelTooltipText?: Partial<Record<NodePingMetric, string>>
}

function getLatencyToneClass(latency: number): string {
  if (latency <= 60)
    return 'bg-emerald-600/90'
  if (latency <= 100)
    return 'bg-green-400/80'
  if (latency <= 160)
    return 'bg-lime-400/80'
  if (latency <= 200)
    return 'bg-yellow-400/80'
  return 'bg-rose-500/80'
}

function getLossToneClass(loss: number): string {
  if (loss <= 1)
    return 'bg-emerald-600/90'
  if (loss <= 3)
    return 'bg-green-400/90'
  if (loss <= 6)
    return 'bg-lime-400/90'
  if (loss <= 9)
    return 'bg-yellow-400/90'
  return 'bg-rose-500/80'
}

export function useNodePingDisplay(
  uuid: string,
  options: UseNodePingDisplayOptions = {},
) {
  const publicSettings = useAppStore(state => state.publicSettings)
  const pingStatsEnabled = (options.enabled ?? true)
    && publicSettings?.record_enabled !== false
    && publicSettings?.ping_record_preserve_time !== 0
  const preserveTime = publicSettings?.ping_record_preserve_time
  const pingStatsHours = typeof preserveTime === 'number' && preserveTime > 0
    ? Math.min(preserveTime, 1)
    : 1

  const pingStats = useNodePingStats(uuid, {
    hours: pingStatsHours,
    enabled: pingStatsEnabled,
  })

  const buildPingBars = (metric: NodePingMetric): NodePingBar[] => {
    const points = pingStats.history
    if (!points.length)
      return []

    return points.map((point, index) => {
      const value = point[metric]

      return {
        key: `${point.time}-${index}`,
        className: value === null
          ? 'bg-muted-foreground/15'
          : metric === 'latency'
            ? getLatencyToneClass(value)
            : getLossToneClass(value),
        tooltip: value === null
          ? `${formatDateTime(point.time, 'HH:mm:ss')} N/A`
          : metric === 'latency'
            ? `${formatDateTime(point.time, 'HH:mm:ss')}\n${Math.round(value)} ms`
            : `${formatDateTime(point.time, 'HH:mm:ss')}\n${value.toFixed(1)}%`,
      }
    })
  }

  const buildEmptyPingBars = (metric: NodePingMetric): NodePingBar[] => {
    const tooltip = pingStats.loading
      ? '加载中'
      : pingStats.error
        ? '加载失败'
        : !pingStatsEnabled
            ? '未启用记录'
            : metric === 'latency'
              ? 'N/A'
              : 'N/A'

    return Array.from({ length: NODE_PING_BAR_COUNT }, (_, index) => ({
      key: `${metric}-empty-${index}`,
      className: 'bg-muted-foreground/10',
      tooltip,
    }))
  }

  const latencyRenderBars = useMemo(() => {
    const bars = buildPingBars('latency')
    return bars.length ? bars : buildEmptyPingBars('latency')
  }, [pingStats.history, pingStats.loading, pingStats.error, pingStatsEnabled])

  const lossRenderBars = useMemo(() => {
    const bars = buildPingBars('loss')
    return bars.length ? bars : buildEmptyPingBars('loss')
  }, [pingStats.history, pingStats.loading, pingStats.error, pingStatsEnabled])

  const latencyDisplay = pingStats.hasData
    ? `${Math.round(pingStats.avgLatency)} ms`
    : pingStats.loading
      ? options.loadingDisplayText ?? '加载中'
      : options.emptyDisplayText ?? '-'

  const lossDisplay = pingStats.hasData
    ? `${pingStats.avgLoss.toFixed(1)}%`
    : pingStats.loading
      ? options.loadingDisplayText ?? '加载中'
      : options.emptyDisplayText ?? '-'

  const latencyPanelTooltip = !pingStats.hasData
    ? pingStats.loading
      ? options.loadingPanelTooltipText?.latency ?? ''
      : options.emptyPanelTooltipText?.latency ?? ''
    : `平均延迟 ${Math.round(pingStats.avgLatency)} ms`

  const lossPanelTooltip = !pingStats.hasData
    ? pingStats.loading
      ? options.loadingPanelTooltipText?.loss ?? ''
      : options.emptyPanelTooltipText?.loss ?? ''
    : `平均丢包 ${pingStats.avgLoss.toFixed(1)}%${pingStats.avgVolatility > 0 ? `，平均波动 ${pingStats.avgVolatility.toFixed(2)}` : ''}`

  return {
    pingStats,
    pingStatsEnabled,
    pingStatsHours,
    latencyRenderBars,
    lossRenderBars,
    latencyDisplay,
    lossDisplay,
    latencyPanelTooltip,
    lossPanelTooltip,
  }
}
