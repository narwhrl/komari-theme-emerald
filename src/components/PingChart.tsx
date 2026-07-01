'use client'

import type { EChartsOption } from 'echarts'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import EChart from '@/components/EChart'
import { Empty } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { useAppDerived, useAppStore } from '@/stores/app'
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

  const chartRows = useMemo(() => {
    const grouped = new Map<number, Record<string, number | string | null>>()
    for (const record of records) {
      const ts = dayjs(record.time).valueOf()
      const rounded = Math.round(ts / 30_000) * 30_000
      const row = grouped.get(rounded) ?? { time: dayjs(rounded).toISOString() }
      row[String(record.task_id)] = record.value < 0 ? null : record.value
      grouped.set(rounded, row)
    }
    return Array.from(grouped.values()).sort((a, b) => dayjs(a.time as string).valueOf() - dayjs(b.time as string).valueOf())
  }, [records])

  const allTaskIds = useMemo(() => tasks.map(task => task.id), [tasks])
  const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id))
  const taskSelectionView = selectedTaskIds.length === 0
    ? 'none'
    : selectedTaskIds.length === tasks.length
      ? 'all'
      : 'custom'
  const theme = {
    text: isDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)',
    textSecondary: isDark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)',
    splitLineColor: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
    tooltipBg: isDark ? 'rgba(40,40,40,.95)' : 'rgba(255,255,255,.88)',
  }

  const option: EChartsOption = {
    animation: false,
    color: chartColors,
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.tooltipBg,
      borderColor: 'transparent',
      textStyle: { color: theme.text, fontSize: 12 },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { fontSize: 11, color: theme.textSecondary },
      data: selectedTasks.map(task => task.name),
    },
    grid: { top: 30, right: 24, bottom: 52, left: 56 },
    xAxis: {
      type: 'category',
      data: chartRows.map(row => selectedHours >= 24 ? dayjs(row.time as string).format('M/D HH:mm') : dayjs(row.time as string).format('HH:mm')),
      boundaryGap: false,
      axisLabel: { color: theme.textSecondary, fontSize: 11 },
      axisLine: { lineStyle: { color: theme.splitLineColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '延迟 (ms)',
      axisLabel: { color: theme.textSecondary, fontSize: 11 },
      splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } },
    },
    series: selectedTasks.map((task, index) => ({
      name: task.name,
      type: 'line',
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.5, color: chartColors[index % chartColors.length] },
      data: chartRows.map(row => row[String(task.id)] as number | null ?? null),
    })),
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
        ? <div className="flex h-40 items-center justify-center"><Spinner /></div>
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
                    {tasks.map((task, index) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card/95 p-2 text-left shadow-xs transition-[background-color,border-color,opacity,box-shadow] hover:border-foreground/15 hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none ${!selectedTaskIds.includes(task.id) ? 'opacity-30' : ''}`}
                        onClick={() => toggleTask(task.id)}
                      >
                        <div className="h-4 w-1 rounded" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
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
                  <div className="vercel-card h-80 rounded-md bg-card/95 p-4">
                    <EChart option={option} />
                  </div>
                </>
              )}
    </div>
  )
}
