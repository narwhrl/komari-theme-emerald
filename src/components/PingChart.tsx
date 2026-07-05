'use client'

import type { EChartsOption } from 'echarts'
import { Icon } from '@iconify/react'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import EChart from '@/components/EChart'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Group, GroupSeparator } from '@/components/ui/group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { useAppDerived, useAppStore } from '@/stores/app'
import { cutPeakValues, interpolateNullsLinear } from '@/utils/recordHelper'
import { getSharedRpc } from '@/utils/rpc'

interface PingRecord {
  client: string
  task_id: number
  time: string
  value: number
}

interface TaskInfo {
  id: number
  name: string
  interval: number
  loss: number
  avg?: number
}

interface PingRecordsResponse {
  count: number
  records: PingRecord[]
  tasks?: TaskInfo[]
}

const presetViews = [
  { label: '1 小时', hours: 1 },
  { label: '6 小时', hours: 6 },
  { label: '12 小时', hours: 12 },
  { label: '1 天', hours: 24 },
]

const chartColors = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#60A5FA', '#FFB347', '#F472B6', '#34D399', '#FB923C']
const chartMargin = { top: 30, right: 24, bottom: 52, left: 56 }
const pingTaskSkeletonItems = ['unicom', 'mobile', 'telecom', 'cloudflare']
const pingChartSkeletonPaths = [
  'M0 154 C58 134 94 146 137 126 C184 104 229 109 272 118 C325 130 361 95 416 104 C476 114 514 83 640 96',
  'M0 112 C52 119 94 91 145 99 C202 108 238 134 292 122 C343 111 374 143 426 130 C493 114 543 122 640 104',
  'M0 183 C78 172 109 189 162 176 C217 162 264 181 314 169 C372 155 413 171 466 151 C526 129 574 143 640 122',
]

function formatTime(time: string, showDate: boolean): string {
  const date = dayjs(time)
  return showDate ? date.format('M/D HH:mm') : date.format('HH:mm')
}

function formatTimeForTooltip(time: string, hours: number): string {
  const date = dayjs(time)
  return hours < 24 ? date.format('HH:mm:ss') : date.format('MM/DD HH:mm')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

interface TooltipParam {
  seriesName?: string
  value?: unknown
  dataIndex?: number
}

function normalizeTooltipParams(params: unknown): TooltipParam[] {
  if (Array.isArray(params))
    return params as TooltipParam[]
  if (params && typeof params === 'object')
    return [params as TooltipParam]
  return []
}

function getNumericTooltipValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  if (Array.isArray(value)) {
    const candidate = value.at(-1)
    if (typeof candidate === 'number' && Number.isFinite(candidate))
      return candidate
  }
  return null
}

export default function PingChart({ uuid, className }: { uuid: string, className?: string }) {
  const publicSettings = useAppStore(state => state.publicSettings)
  const { isDark } = useAppDerived()
  const maxHours = publicSettings?.ping_record_preserve_time || 168
  const views = presetViews.filter(view => maxHours >= view.hours)
  const [selectedView, setSelectedView] = useState(views[0]?.label ?? '1 小时')
  const selectedHours = views.find(view => view.label === selectedView)?.hours ?? 1
  const [records, setRecords] = useState<PingRecord[]>([])
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([])
  const [showDelay, setShowDelay] = useState(true)
  const [showLoss, setShowLoss] = useState(true)
  const [cutPeak, setCutPeak] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchRecords() {
      setLoading(true)
      setError(null)
      try {
        const result = await getSharedRpc().getClient().call<PingRecordsResponse>('common:getRecords', {
          uuid,
          type: 'ping',
          hours: selectedHours,
        })
        const nextRecords = (result.records ?? []).sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())
        const nextTasks = result.tasks ?? []
        if (!cancelled) {
          setRecords(nextRecords)
          setTasks(nextTasks)
          setSelectedTaskIds(current => current.length ? current.filter(id => nextTasks.some(task => task.id === id)) : nextTasks.map(task => task.id))
        }
      }
      catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取数据失败')
          setRecords([])
          setTasks([])
        }
      }
      finally {
        if (!cancelled)
          setLoading(false)
      }
    }
    void fetchRecords()
    return () => {
      cancelled = true
    }
  }, [selectedHours, uuid])

  const mergeToleranceMs = useMemo(() => {
    const taskIntervals = tasks
      .map(task => task.interval)
      .filter(interval => typeof interval === 'number' && interval > 0)

    const fallbackIntervalSec = taskIntervals.length ? Math.min(...taskIntervals) : 60

    return Math.min(
      6000,
      Math.max(800, Math.floor(fallbackIntervalSec * 1000 * 0.25)),
    )
  }, [tasks])

  const mergedData = useMemo(() => {
    if (!records.length)
      return []

    const grouped = new Map<number, Record<string, number | string | null>>()
    const anchors: number[] = []

    for (const record of records) {
      const ts = dayjs(record.time).valueOf()
      let anchor: number | null = null

      for (const candidate of anchors) {
        if (Math.abs(candidate - ts) <= mergeToleranceMs) {
          anchor = candidate
          break
        }
      }

      const useTs = anchor ?? ts
      if (!grouped.has(useTs)) {
        grouped.set(useTs, { time: dayjs(useTs).toISOString() })
        if (anchor === null)
          anchors.push(useTs)
      }

      const row = grouped.get(useTs)
      if (row)
        row[String(record.task_id)] = record.value < 0 ? null : record.value
    }

    const merged = Array.from(grouped.values()).sort((a, b) => dayjs(a.time as string).valueOf() - dayjs(b.time as string).valueOf())
    const lastItem = merged.at(-1)
    const lastTs = lastItem ? dayjs(lastItem.time as string).valueOf() : dayjs().valueOf()
    const fromTs = lastTs - selectedHours * 3600_000

    let startIdx = 0
    for (let i = 0; i < merged.length; i++) {
      const item = merged[i]
      if (!item)
        continue
      const ts = dayjs(item.time as string).valueOf()
      if (ts >= fromTs) {
        startIdx = Math.max(0, i - 1)
        break
      }
    }

    return merged.slice(startIdx)
  }, [mergeToleranceMs, records, selectedHours])

  const selectedKeys = useMemo(() => selectedTaskIds.map(String), [selectedTaskIds])

  const chartData = useMemo(() => {
    if (!selectedKeys.length || !mergedData.length)
      return []

    const data = cutPeak
      ? cutPeakValues(mergedData, selectedKeys)
      : mergedData

    return interpolateNullsLinear(data, selectedKeys, {
      maxGapMultiplier: 6,
      minCapMs: 2 * 60_000,
      maxCapMs: 30 * 60_000,
    }) as Record<string, number | string | null>[]
  }, [cutPeak, mergedData, selectedKeys])

  const packetLossMarkers = useMemo(() => {
    const markers = new Map<number, number[]>()
    if (!mergedData.length)
      return markers

    const chartTimes = mergedData.map(item => dayjs(item.time as string).valueOf())
    const selectedIdSet = new Set(selectedTaskIds)

    for (const task of tasks) {
      if (!selectedIdSet.has(task.id))
        continue

      const points = new Set<number>()
      const taskLossRecords = records.filter(record => record.task_id === task.id && record.value < 0)

      for (const record of taskLossRecords) {
        const lossTs = dayjs(record.time).valueOf()
        let matchedIndex = -1

        for (let i = 0; i < chartTimes.length; i++) {
          const chartTs = chartTimes[i]
          if (chartTs === undefined)
            continue

          if (Math.abs(chartTs - lossTs) <= mergeToleranceMs) {
            matchedIndex = i
            break
          }
        }

        if (matchedIndex >= 0)
          points.add(matchedIndex)
      }

      markers.set(task.id, Array.from(points).sort((a, b) => a - b))
    }

    return markers
  }, [mergeToleranceMs, mergedData, records, selectedTaskIds, tasks])

  const getTaskColor = (taskId: number) => {
    const taskIndex = tasks.findIndex(task => task.id === taskId)
    return chartColors[Math.max(0, taskIndex) % chartColors.length] ?? chartColors[0]
  }

  const allTaskIds = useMemo(() => tasks.map(task => task.id), [tasks])
  const selectedTasks = useMemo(() => tasks.filter(task => selectedTaskIds.includes(task.id)), [selectedTaskIds, tasks])

  const taskSelectionView = selectedTaskIds.length === 0
    ? 'none'
    : selectedTaskIds.length === tasks.length
      ? 'all'
      : 'custom'
  const showDateInAxis = selectedHours >= 24
  const theme = {
    text: isDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)',
    textSecondary: isDark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)',
    textTertiary: isDark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)',
    borderColor: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)',
    splitLineColor: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
    tooltipBg: isDark ? 'rgba(40,40,40,.95)' : 'rgba(255,255,255,.88)',
    tooltipShadow: isDark ? 'rgba(0,0,0,.4)' : 'rgba(0,0,0,.06)',
    crosshairColor: isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)',
  }

  const option: EChartsOption = {
    animation: false,
    color: tasks.map((_, index) => chartColors[index % chartColors.length]),
    tooltip: {
      trigger: 'axis',
      confine: false,
      backgroundColor: theme.tooltipBg,
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 6,
      textStyle: { color: theme.text, fontSize: 12, lineHeight: 20 },
      extraCssText: `backdrop-filter: blur(5px);z-index:9;box-shadow:0 0 0 1px ${theme.tooltipShadow}, 0 0 16px ${theme.tooltipShadow}`,
      axisPointer: {
        type: 'cross',
        crossStyle: { color: theme.textTertiary },
        lineStyle: { color: theme.crosshairColor, width: 1, type: 'dashed' },
        shadowStyle: { color: theme.crosshairColor },
      },
      formatter: (params: unknown) => {
        const items = normalizeTooltipParams(params)
        const firstItem = items[0]
        if (!firstItem || firstItem.dataIndex === undefined)
          return ''

        const rowData = chartData[firstItem.dataIndex]
        if (!rowData)
          return ''

        const timeStr = formatTimeForTooltip(rowData.time as string, selectedHours)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${theme.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        const sortedItems = items
          .map(item => ({ ...item, numericValue: getNumericTooltipValue(item.value) }))
          .filter((item): item is TooltipParam & { numericValue: number } => item.numericValue !== null)
          .sort((a, b) => a.numericValue - b.numericValue)

        for (const item of sortedItems) {
          const task = tasks.find(candidate => candidate.name === item.seriesName)
          const color = task ? getTaskColor(task.id) : chartColors[0]
          const colorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px;flex-shrink:0"></span>`
          html += `<div style="display:flex;align-items:center">${colorDot}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.seriesName ?? '')}</span><span style="margin-left:16px;font-weight:600;font-variant-numeric:tabular-nums">${Math.round(item.numericValue)} ms</span></div>`
        }

        html += '</div>'
        return html
      },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
      icon: 'roundRect',
      textStyle: { fontSize: 11, color: theme.textSecondary },
      data: selectedTasks.map(task => task.name),
    },
    grid: chartMargin,
    xAxis: {
      type: 'category',
      data: chartData.map(row => formatTime(row.time as string, showDateInAxis)),
      boundaryGap: false,
      axisLabel: { color: theme.textSecondary, fontSize: 11, margin: 12 },
      axisLine: { show: true, lineStyle: { color: theme.borderColor, width: 1 } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '延迟 (ms)',
      nameTextStyle: { color: theme.textSecondary },
      axisLabel: { color: theme.textSecondary, fontSize: 11, formatter: '{value}' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } },
    },
    series: selectedTasks.map((task) => {
      const color = getTaskColor(task.id)
      const lossMarkerIndexes = packetLossMarkers.get(task.id) ?? []

      return {
        name: task.name,
        type: 'line',
        data: chartData.map(row => row[String(task.id)] as number | null ?? null),
        smooth: showDelay ? (cutPeak ? 0.6 : 0.1) : 0,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: showDelay ? 1.5 : 0, color, cap: 'round' },
        itemStyle: { color, opacity: showDelay ? 1 : 0 },
        markLine: showLoss && lossMarkerIndexes.length
          ? {
              silent: true,
              symbol: ['none', 'none'],
              animation: false,
              label: { show: false },
              lineStyle: {
                color,
                width: 1,
                type: 'solid',
                opacity: 0.55,
              },
              data: lossMarkerIndexes.map(index => ({ xAxis: index })),
            }
          : undefined,
      }
    }),
  }

  function toggleTask(taskId: number) {
    setSelectedTaskIds(current => current.includes(taskId) ? current.filter(id => id !== taskId) : [...current, taskId])
  }

  function handleTaskSelectionChange(value: string | number | null) {
    if (value === 'all')
      setSelectedTaskIds(allTaskIds)
    if (value === 'none')
      setSelectedTaskIds([])
  }

  return (
    <div className={`flex flex-col gap-4 ${className ?? ''}`}>
      <Tabs value={selectedView} onValueChange={value => setSelectedView(String(value))} className="w-full">
        <div className="min-w-0 overflow-x-auto rounded-sm">
          <TabsList aria-label="延迟历史时间段">
            {views.map(view => <TabsTab key={view.label} value={view.label}>{view.label}</TabsTab>)}
          </TabsList>
        </div>
      </Tabs>
      {loading
        ? <PingChartSkeleton />
        : error
          ? <div className="py-8 text-center text-red-500">{error}</div>
          : tasks.length === 0
            ? <Empty description="暂无延迟数据" />
            : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tabs value={taskSelectionView} onValueChange={handleTaskSelectionChange}>
                      <TabsList aria-label="延迟历史任务选择">
                        <TabsTab value="all">全选</TabsTab>
                        <TabsTab value="none">全不选</TabsTab>
                      </TabsList>
                    </Tabs>
                    <div className="text-xs text-muted-foreground">
                      已选择
                      {' '}
                      {selectedTaskIds.length}
                      {' '}
                      /
                      {' '}
                      {tasks.length}
                    </div>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    {tasks.map(task => (
                      <button
                        key={task.id}
                        type="button"
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-input bg-card p-2 text-left shadow-xs/5 transition-[background-color,border-color,opacity,box-shadow] hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none ${!selectedTaskIds.includes(task.id) ? 'opacity-30' : ''}`}
                        onClick={() => toggleTask(task.id)}
                      >
                        <div className="h-4 w-1 rounded" style={{ backgroundColor: getTaskColor(task.id) }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{task.name}</div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{task.avg !== undefined ? `${Math.round(task.avg)}ms` : '-'}</span>
                            <span className="opacity-60">·</span>
                            <span>
                              {task.loss.toFixed(2)}
                              %
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Group aria-label="延迟图表显示选项">
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={showDelay}
                      onClick={() => setShowDelay(value => !value)}
                    >
                      <Icon icon="lucide:clock" aria-hidden="true" className="size-4" />
                      延迟
                    </Button>
                    <GroupSeparator />
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={showLoss}
                      onClick={() => setShowLoss(value => !value)}
                    >
                      <Icon icon="lucide:package-x" aria-hidden="true" className="size-4" />
                      丢包
                    </Button>
                    <GroupSeparator />
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={cutPeak}
                      onClick={() => setCutPeak(value => !value)}
                    >
                      <Icon icon="lucide:chart-spline" aria-hidden="true" className="size-4" />
                      平滑峰值
                    </Button>
                  </Group>
                  <div className="vercel-card h-80 rounded-2xl bg-card p-4">
                    <EChart option={option} />
                  </div>
                </>
              )}
    </div>
  )
}

function PingChartSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md bg-muted/50 p-1">
          <Skeleton className="h-7 w-13 rounded-sm" />
          <Skeleton className="h-7 w-16 rounded-sm" />
        </div>
        <Skeleton className="h-3 w-18" />
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {pingTaskSkeletonItems.map(item => <PingTaskSkeletonCard key={item} />)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-13 rounded-sm" />
        <Skeleton className="h-7 w-13 rounded-sm" />
        <Skeleton className="h-7 w-20 rounded-sm" />
      </div>
      <div className="vercel-card h-80 rounded-2xl bg-card p-4">
        <div className="relative h-full overflow-hidden rounded-sm">
          <div className="absolute top-3 right-0 flex items-center gap-2">
            <Skeleton className="h-2.5 w-11 rounded-full" />
            <Skeleton className="h-2.5 w-14 rounded-full" />
          </div>
          <div className="absolute top-7 bottom-9 left-0 flex w-7 flex-col justify-between">
            <Skeleton className="h-2 w-5 rounded-full opacity-70" />
            <Skeleton className="h-2 w-4 rounded-full opacity-60" />
            <Skeleton className="h-2 w-5 rounded-full opacity-50" />
            <Skeleton className="h-2 w-3 rounded-full opacity-45" />
          </div>
          <div className="absolute top-7 right-0 bottom-9 left-9 overflow-hidden">
            <div className="absolute inset-0 flex flex-col justify-between">
              <span className="border-t border-dashed border-border/60" />
              <span className="border-t border-dashed border-border/45" />
              <span className="border-t border-dashed border-border/35" />
              <span className="border-t border-dashed border-border/30" />
            </div>
            <div className="absolute inset-0 flex justify-between">
              <span className="border-l border-border/30" />
              <span className="border-l border-border/20" />
              <span className="border-l border-border/20" />
              <span className="border-l border-border/20" />
              <span className="border-l border-border/30" />
            </div>
            <svg className="absolute inset-0 size-full" viewBox="0 0 640 220" preserveAspectRatio="none" aria-hidden="true">
              {pingChartSkeletonPaths.map((path, index) => (
                <path
                  key={path}
                  d={path}
                  className={`komari-skeleton-chart-line komari-skeleton-chart-line-${index + 1}`}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/70 via-transparent to-card/70" />
          </div>
          <div className="absolute right-0 bottom-0 left-9 flex justify-between">
            <Skeleton className="h-2.5 w-10 rounded-full opacity-60" />
            <Skeleton className="h-2.5 w-10 rounded-full opacity-55" />
            <Skeleton className="h-2.5 w-10 rounded-full opacity-55" />
            <Skeleton className="h-2.5 w-10 rounded-full opacity-60" />
          </div>
        </div>
      </div>
    </>
  )
}

function PingTaskSkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-input bg-card p-2 shadow-xs/5">
      <Skeleton className="h-4 w-1 rounded" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-28" />
        <div className="mt-2 flex items-center gap-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-1 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}
