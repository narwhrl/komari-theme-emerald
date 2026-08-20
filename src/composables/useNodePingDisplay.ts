'use client'

import type { NodePingPerTaskStat, NodePingStatsResult } from '@/composables/useNodePingStats'
import { useCallback, useMemo } from 'react'
import { NODE_PING_BAR_COUNT, useNodePingStats } from '@/composables/useNodePingStats'
import { useAppDerived } from '@/stores/app'
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

export interface NodePingNetworkDisplay {
  taskId: number
  name: string
  latency: string
  toneClass: string
}

export interface UseNodePingDisplayResult {
  pingStats: NodePingStatsResult
  pingStatsEnabled: boolean
  pingStatsHours: number
  latencyRenderBars: NodePingBar[]
  lossRenderBars: NodePingBar[]
  latencyDisplay: string
  lossDisplay: string
  latencyPanelTooltip: string
  lossPanelTooltip: string
  topPingNetworks: NodePingNetworkDisplay[]
}
const RECENT_PING_RECORDS_QUERY_HOURS = 1

const PING_NETWORK_DISPLAY_COUNT = 3

export function getPingToneClass(value: number): string {
  if (!value)
    return 'text-muted-foreground'
  if (value <= 60)
    return 'text-emerald-700 dark:text-emerald-400'
  if (value <= 120)
    return 'text-green-700 dark:text-green-400'
  if (value <= 180)
    return 'text-lime-700 dark:text-lime-400'
  if (value <= 240)
    return 'text-amber-700 dark:text-amber-400'
  return 'text-rose-700 dark:text-rose-400'
}

function getLatencyToneClass(latency: number): string {
  if (latency <= 60)
    return 'bg-emerald-600/90'
  if (latency <= 120)
    return 'bg-green-500/80'
  if (latency <= 180)
    return 'bg-lime-400/80'
  if (latency <= 240)
    return 'bg-yellow-400/80'
  return 'bg-rose-500/80'
}

function getLossToneClass(loss: number): string {
  if (loss <= 1)
    return 'bg-emerald-600/90'
  if (loss <= 3)
    return 'bg-green-500/80'
  if (loss <= 6)
    return 'bg-lime-400/80'
  if (loss <= 9)
    return 'bg-yellow-400/80'
  return 'bg-rose-500/80'
}

function toNetworkDisplay(stat: NodePingPerTaskStat): NodePingNetworkDisplay {
  return {
    taskId: stat.taskId,
    name: stat.name,
    latency: stat.avgLatency >= 0 ? `${Math.round(stat.avgLatency)}ms` : '--',
    toneClass: stat.avgLatency >= 0 ? getPingToneClass(stat.avgLatency) : 'text-rose-700 dark:text-rose-400',
  }
}

export function useNodePingDisplay(
  uuid: string,
  options: UseNodePingDisplayOptions = {},
): UseNodePingDisplayResult {
  const { pingNetworkOrder } = useAppDerived()
  const pingStatsEnabled = options.enabled ?? true
  const pingStatsHours = RECENT_PING_RECORDS_QUERY_HOURS

  const pingStats = useNodePingStats(uuid, {
    hours: pingStatsHours,
    enabled: pingStatsEnabled,
  })

  const buildPingBars = useCallback((metric: NodePingMetric): NodePingBar[] => {
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
  }, [pingStats.history])

  const buildEmptyPingBars = useCallback((metric: NodePingMetric): NodePingBar[] => {
    const tooltip = pingStats.loading
      ? '加载中'
      : pingStats.error
        ? '加载失败'
        : !pingStatsEnabled
            ? '未启用记录'
            : 'N/A'

    return Array.from({ length: NODE_PING_BAR_COUNT }, (_, index) => ({
      key: `${metric}-empty-${index}`,
      className: 'bg-muted-foreground/10',
      tooltip,
    }))
  }, [pingStats.error, pingStats.loading, pingStatsEnabled])

  const latencyRenderBars = useMemo(() => {
    const bars = buildPingBars('latency')
    return bars.length ? bars : buildEmptyPingBars('latency')
  }, [buildEmptyPingBars, buildPingBars])

  const lossRenderBars = useMemo(() => {
    const bars = buildPingBars('loss')
    return bars.length ? bars : buildEmptyPingBars('loss')
  }, [buildEmptyPingBars, buildPingBars])

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

  const topPingNetworks = useMemo(() => {
    const perTaskStats = pingStats.perTaskStats
    if (!pingNetworkOrder.length)
      return perTaskStats.slice(0, PING_NETWORK_DISPLAY_COUNT).map(toNetworkDisplay)

    const statsByName = new Map(perTaskStats.map(stat => [stat.name, stat]))
    const selected: NodePingPerTaskStat[] = []
    const usedTaskIds = new Set<number>()

    for (const name of pingNetworkOrder) {
      if (selected.length >= PING_NETWORK_DISPLAY_COUNT)
        break
      const stat = statsByName.get(name)
      if (stat && !usedTaskIds.has(stat.taskId)) {
        selected.push(stat)
        usedTaskIds.add(stat.taskId)
      }
    }

    for (const stat of perTaskStats) {
      if (selected.length >= PING_NETWORK_DISPLAY_COUNT)
        break
      if (!usedTaskIds.has(stat.taskId)) {
        selected.push(stat)
        usedTaskIds.add(stat.taskId)
      }
    }

    return selected.map(toNetworkDisplay)
  }, [pingNetworkOrder, pingStats.perTaskStats])

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
    topPingNetworks,
  }
}
