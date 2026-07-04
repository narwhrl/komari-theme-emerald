'use client'

import type { EChartsOption } from 'echarts'
import type { ReactNode } from 'react'
import type { RecordFormat } from '@/utils/recordHelper'
import type { StatusRecord } from '@/utils/rpc'
import { Icon } from '@iconify/react'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import EChart from '@/components/EChart'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { useAppDerived, useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesSplit, formatBytesWithConfig } from '@/utils/helper'
import { fillMissingTimePoints } from '@/utils/recordHelper'
import { getSharedRpc } from '@/utils/rpc'

const presetViews = [
  { label: '4 小时', hours: 4 },
  { label: '1 天', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
]

const chartColors = {
  primary: '#FF6B6B',
  secondary: '#FFB347',
  tertiary: '#4ECDC4',
  quaternary: '#A78BFA',
  quinary: '#60A5FA',
  success: '#34D399',
}

const chartMargin = { top: 30, right: 24, bottom: 32, left: 56 }
const chartMarginWithLegend = { top: 30, right: 24, bottom: 52, left: 56 }
const chartSkeletonItems = ['cpu', 'memory', 'disk', 'network', 'connections', 'process']
const loadChartSkeletonPaths = [
  'M0 128 C42 116 74 122 111 103 C151 82 189 91 227 99 C274 109 306 76 351 87 C394 98 431 73 512 83',
  'M0 88 C45 101 79 74 122 82 C171 91 199 116 245 104 C291 92 318 118 363 108 C414 96 451 104 512 88',
]

interface ChartTooltipParam {
  dataIndex: number
  seriesName: string
  value: unknown
  color: string
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeLoadRecordsResponse(value: unknown, uuid: string): StatusRecord[] {
  if (Array.isArray(value))
    return [...value] as StatusRecord[]

  if (!isRecordObject(value))
    return []

  if (Array.isArray(value.records))
    return [...value.records] as StatusRecord[]

  if (isRecordObject(value.records)) {
    const recordsForNode = value.records[uuid]
    if (Array.isArray(recordsForNode))
      return [...recordsForNode] as StatusRecord[]

    return Object.values(value.records)
      .flatMap((item) => {
        if (Array.isArray(item))
          return item as StatusRecord[]
        if (isRecordObject(item) && Array.isArray(item.records))
          return item.records as StatusRecord[]
        return []
      })
      .filter(record => record.client === uuid)
  }

  if (isRecordObject(value.data))
    return normalizeLoadRecordsResponse(value.data, uuid)

  const recordsForNode = value[uuid]
  return Array.isArray(recordsForNode) ? [...recordsForNode] as StatusRecord[] : []
}

function statusToRecordFormat(records: StatusRecord[]): RecordFormat[] {
  return records.map(r => ({
    client: r.client,
    time: r.time,
    cpu: r.cpu ?? null,
    gpu: r.gpu ?? null,
    gpu_usage: null,
    gpu_memory: null,
    ram: r.ram ?? null,
    ram_total: r.ram_total ?? null,
    swap: r.swap ?? null,
    swap_total: r.swap_total ?? null,
    load: r.load ?? null,
    temp: r.temp ?? null,
    disk: r.disk ?? null,
    disk_total: r.disk_total ?? null,
    net_in: r.net_in ?? null,
    net_out: r.net_out ?? null,
    net_total_up: r.net_total_up ?? null,
    net_total_down: r.net_total_down ?? null,
    process: r.process ?? null,
    connections: r.connections ?? null,
    connections_udp: r.connections_udp ?? null,
  }))
}

function getAvailableViews(maxHours: number): { label: string, hours?: number }[] {
  const views: { label: string, hours?: number }[] = [{ label: '实时' }]

  for (const view of presetViews) {
    if (maxHours >= view.hours)
      views.push({ label: view.label, hours: view.hours })
  }

  const maxPreset = presetViews.at(-1)
  if (maxPreset && maxHours > maxPreset.hours) {
    views.push({ label: formatHoursLabel(maxHours), hours: maxHours })
  }
  else if (maxHours > 4 && !presetViews.some(view => view.hours === maxHours)) {
    views.push({ label: formatHoursLabel(maxHours), hours: maxHours })
  }

  return views
}

function formatHoursLabel(hours: number): string {
  return hours % 24 === 0 ? `${Math.floor(hours / 24)} 天` : `${hours} 小时`
}

function formatTime(time: string, showDate: boolean): string {
  const date = dayjs(time)
  return showDate ? date.format('M/D HH:mm') : date.format('HH:mm')
}

function formatTimeForTooltip(time: string, hours: number): string {
  const date = dayjs(time)
  return hours < 24 ? date.format('HH:mm:ss') : date.format('MM/DD HH:mm')
}

function normalizeTooltipParams(params: unknown): ChartTooltipParam[] {
  if (!params)
    return []
  return (Array.isArray(params) ? params : [params]) as ChartTooltipParam[]
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatNullableFixed(value: number | null | undefined, decimals = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(decimals) : '-'
}

function colorDot(color: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px;flex-shrink:0"></span>`
}

export default function LoadChart({ uuid, className }: { uuid: string, className?: string }) {
  const publicSettings = useAppStore(state => state.publicSettings)
  const byteDecimals = useAppStore(state => state.byteDecimals)
  const nodeInfo = useNodesStore(state => state.nodes.find(node => node.uuid === uuid))
  const { isDark } = useAppDerived()
  const maxRecordPreserveTime = publicSettings?.record_preserve_time || 720
  const dataUpdateInterval = useMemo(() => {
    const interval = publicSettings?.theme_settings?.dataUpdateInterval
    return typeof interval === 'number' && interval >= 1 && interval <= 60 ? interval * 1000 : 3000
  }, [publicSettings?.theme_settings])
  const availableViews = useMemo(() => getAvailableViews(maxRecordPreserveTime), [maxRecordPreserveTime])
  const [selectedView, setSelectedView] = useState('实时')
  const activeView = availableViews.some(view => view.label === selectedView) ? selectedView : availableViews[0]?.label ?? '实时'
  const selectedHours = availableViews.find(view => view.label === activeView)?.hours
  const isRealtime = selectedHours === undefined
  const [remoteData, setRemoteData] = useState<StatusRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData(showLoading: boolean) {
      if (!uuid)
        return

      if (showLoading)
        setLoading(true)
      setError(null)

      try {
        const rpc = getSharedRpc()
        const result = isRealtime
          ? await rpc.getNodeRecentStatus(uuid, 150)
          : await rpc.getLoadRecords(uuid, selectedHours)
        const records = normalizeLoadRecordsResponse(result, uuid)
          .sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())

        if (!cancelled)
          setRemoteData(isRealtime ? records.slice(-150) : records)
      }
      catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取数据失败')
          setRemoteData([])
        }
      }
      finally {
        if (!cancelled)
          setLoading(false)
      }
    }

    void fetchData(true)

    if (isRealtime) {
      const interval = window.setInterval(() => void fetchData(false), dataUpdateInterval)
      return () => {
        cancelled = true
        window.clearInterval(interval)
      }
    }

    return () => {
      cancelled = true
    }
  }, [dataUpdateInterval, isRealtime, selectedHours, uuid])

  const chartData = useMemo(() => {
    const records = statusToRecordFormat(remoteData)
    if (!records.length || isRealtime)
      return records

    const hours = selectedHours || 4
    const minute = 60
    const hour = minute * 60
    let intervalSec: number
    let maxGap: number

    if (hours <= 4) {
      intervalSec = minute
      maxGap = minute * 2
    }
    else if (hours > 120) {
      intervalSec = hour
      maxGap = hour * 2
    }
    else {
      intervalSec = minute * 15
      maxGap = minute * 30
    }

    return fillMissingTimePoints(records, intervalSec, hours * 3600, maxGap)
  }, [isRealtime, remoteData, selectedHours])

  const latestStatus = useMemo(() => remoteData.at(-1) ?? null, [remoteData])

  const chartThemeColors = useMemo(() => ({
    text: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)',
    textSecondary: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)',
    textTertiary: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    splitLineColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    tooltipBg: isDark ? 'rgba(40, 40, 40, 0.95)' : 'rgba(255, 255, 255, 0.8)',
    tooltipShadow: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.06)',
    crosshairColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
  }), [isDark])

  const showDateInAxis = (selectedHours || 1) >= 24
  const formatBytesValue = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? formatBytesWithConfig(value, byteDecimals) : '-'
  const formatBytesBrief = (value: number | null | undefined, suffix = '') => {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return '-'
    const formatted = formatBytesSplit(value, byteDecimals)
    return `${formatted.value} ${formatted.unit}${suffix}`
  }

  const baseTooltipConfig = {
    trigger: 'axis' as const,
    confine: false,
    backgroundColor: chartThemeColors.tooltipBg,
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 6,
    textStyle: {
      color: chartThemeColors.text,
      fontSize: 12,
      lineHeight: 20,
    },
    extraCssText: `backdrop-filter: blur(5px);z-index:9;box-shadow:0 0 0 1px ${chartThemeColors.tooltipShadow}, 0 0 16px ${chartThemeColors.tooltipShadow}`,
    axisPointer: {
      type: 'cross' as const,
      crossStyle: {
        color: chartThemeColors.textTertiary,
      },
      lineStyle: {
        color: chartThemeColors.crosshairColor,
        width: 1,
        type: 'dashed' as const,
      },
      shadowStyle: {
        color: chartThemeColors.crosshairColor,
      },
    },
  }

  const baseXAxisConfig = {
    type: 'category' as const,
    data: chartData.map(record => formatTime(record.time, showDateInAxis)),
    axisLabel: {
      fontSize: 11,
      color: chartThemeColors.textSecondary,
      margin: 12,
    },
    axisLine: {
      show: true,
      lineStyle: { color: chartThemeColors.borderColor, width: 1 },
    },
    axisTick: { show: false },
    boundaryGap: false,
  }

  const baseYAxisConfig = {
    type: 'value' as const,
    axisLabel: {
      fontSize: 11,
      color: chartThemeColors.textSecondary,
    },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: {
      lineStyle: {
        color: chartThemeColors.splitLineColor,
        type: 'dashed' as const,
      },
    },
  }

  const cpuChartOption: EChartsOption = {
    animation: false,
    color: [chartColors.primary, chartColors.secondary],
    tooltip: {
      ...baseTooltipConfig,
      formatter: (params: unknown) => {
        const items = normalizeTooltipParams(params)
        const firstParam = items[0]
        if (!firstParam)
          return ''
        const record = chartData[firstParam.dataIndex]
        if (!record)
          return ''

        const timeStr = formatTimeForTooltip(record.time, selectedHours || 1)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          const value = asNumber(item.value)
          if (item.seriesName === 'CPU') {
            html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>CPU</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatNullableFixed(value, 1)}%</span></div>`
          }
          else if (item.seriesName === '负载') {
            html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>系统负载</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatNullableFixed(value, 2)}</span></div>`
          }
        }
        html += '</div>'
        return html
      },
    },
    grid: chartMargin,
    xAxis: baseXAxisConfig,
    yAxis: [
      {
        ...baseYAxisConfig,
        name: 'CPU %',
        nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
        min: 0,
        max: 100,
        axisLabel: { ...baseYAxisConfig.axisLabel, formatter: '{value}%' },
      },
      {
        ...baseYAxisConfig,
        name: '负载',
        nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 0, 0, 40] },
        min: 0,
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'CPU',
        type: 'line',
        data: chartData.map(record => record.cpu),
        showSymbol: false,
        yAxisIndex: 0,
        lineStyle: { width: 1.5, color: chartColors.primary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 107, 107, 0.25)' },
              { offset: 1, color: 'rgba(255, 107, 107, 0.02)' },
            ],
          },
        },
      },
      {
        name: '负载',
        type: 'line',
        data: chartData.map(record => record.load),
        showSymbol: false,
        yAxisIndex: 1,
        lineStyle: { width: 1.5, color: chartColors.secondary },
      },
    ],
  }

  const memoryChartOption: EChartsOption = {
    animation: false,
    color: [chartColors.primary, chartColors.secondary],
    tooltip: {
      ...baseTooltipConfig,
      formatter: (params: unknown) => {
        const items = normalizeTooltipParams(params)
        const firstParam = items[0]
        if (!firstParam)
          return ''
        const record = chartData[firstParam.dataIndex]
        if (!record)
          return ''

        const ramUsed = record.ram ?? 0
        const ramTotal = record.ram_total ?? nodeInfo?.mem_total ?? 0
        const swapUsed = record.swap ?? 0
        const swapTotal = record.swap_total ?? nodeInfo?.swap_total ?? 0
        const ramPercent = ramTotal > 0 ? ((ramUsed / ramTotal) * 100).toFixed(1) : '0'
        const swapPercent = swapTotal > 0 ? ((swapUsed / swapTotal) * 100).toFixed(1) : '0'

        const timeStr = formatTimeForTooltip(record.time, selectedHours || 1)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          if (item.seriesName === 'RAM') {
            html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>RAM</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatBytesValue(ramUsed)} (${ramPercent}%)</span></div>`
          }
          else if (item.seriesName === 'Swap') {
            html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>Swap</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatBytesValue(swapUsed)} (${swapPercent}%)</span></div>`
          }
        }
        html += '</div>'
        return html
      },
    },
    grid: chartMargin,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: '内存',
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => formatBytesValue(val),
      },
    },
    series: [
      {
        name: 'RAM',
        type: 'line',
        data: chartData.map(record => record.ram ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.primary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 107, 107, 0.25)' },
              { offset: 1, color: 'rgba(255, 107, 107, 0.02)' },
            ],
          },
        },
      },
      {
        name: 'Swap',
        type: 'line',
        data: chartData.map(record => record.swap ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.secondary },
      },
    ],
  }

  const diskChartOption: EChartsOption = {
    animation: false,
    color: [chartColors.tertiary],
    tooltip: {
      ...baseTooltipConfig,
      formatter: (params: unknown) => {
        const items = normalizeTooltipParams(params)
        const firstParam = items[0]
        if (!firstParam)
          return ''
        const record = chartData[firstParam.dataIndex]
        if (!record)
          return ''

        const diskUsed = record.disk ?? 0
        const diskTotal = record.disk_total ?? nodeInfo?.disk_total ?? 0
        const diskPercent = diskTotal > 0 ? ((diskUsed / diskTotal) * 100).toFixed(1) : '0'
        const timeStr = formatTimeForTooltip(record.time, selectedHours || 1)

        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'
        html += `<div style="display:flex;align-items:center">${colorDot(firstParam.color)}<span>磁盘已用</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatBytesValue(diskUsed)} (${diskPercent}%)</span></div>`
        html += '</div>'
        return html
      },
    },
    grid: chartMargin,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: '磁盘',
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => formatBytesValue(val),
      },
    },
    series: [
      {
        name: '磁盘已用',
        type: 'line',
        data: chartData.map(record => record.disk ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.tertiary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(78, 205, 196, 0.25)' },
              { offset: 1, color: 'rgba(78, 205, 196, 0.02)' },
            ],
          },
        },
      },
    ],
  }

  const networkChartOption: EChartsOption = {
    animation: false,
    color: [chartColors.quinary, chartColors.quaternary],
    tooltip: {
      ...baseTooltipConfig,
      formatter: (params: unknown) => {
        const items = normalizeTooltipParams(params)
        const firstParam = items[0]
        if (!firstParam)
          return ''
        const record = chartData[firstParam.dataIndex]
        if (!record)
          return ''

        const timeStr = formatTimeForTooltip(record.time, selectedHours || 1)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          const value = asNumber(item.value)
          const label = item.seriesName === '下载' ? '↓ 下载' : '↑ 上传'
          html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>${label}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatBytesValue(value)}/s</span></div>`
        }
        html += '</div>'
        return html
      },
    },
    legend: {
      data: ['下载', '上传'],
      bottom: 4,
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 20,
      icon: 'roundRect',
      textStyle: { fontSize: 11, color: chartThemeColors.textSecondary },
    },
    grid: chartMarginWithLegend,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: '速度',
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => formatBytesValue(val),
      },
    },
    series: [
      {
        name: '下载',
        type: 'line',
        data: chartData.map(record => record.net_in ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.quinary },
      },
      {
        name: '上传',
        type: 'line',
        data: chartData.map(record => record.net_out ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.quaternary },
      },
    ],
  }

  const connectionsChartOption: EChartsOption = {
    animation: false,
    color: [chartColors.primary, chartColors.tertiary],
    tooltip: {
      ...baseTooltipConfig,
      formatter: (params: unknown) => {
        const items = normalizeTooltipParams(params)
        const firstParam = items[0]
        if (!firstParam)
          return ''
        const record = chartData[firstParam.dataIndex]
        if (!record)
          return ''

        const timeStr = formatTimeForTooltip(record.time, selectedHours || 1)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          const value = asNumber(item.value)
          html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>${item.seriesName}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${value != null ? Math.round(value) : '-'}</span></div>`
        }
        html += '</div>'
        return html
      },
    },
    legend: {
      data: ['TCP', 'UDP'],
      bottom: 4,
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 20,
      icon: 'roundRect',
      textStyle: { fontSize: 11, color: chartThemeColors.textSecondary },
    },
    grid: chartMarginWithLegend,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: '连接数',
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      min: 0,
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => Math.round(val).toString(),
      },
    },
    series: [
      {
        name: 'TCP',
        type: 'line',
        data: chartData.map(record => record.connections ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.primary },
      },
      {
        name: 'UDP',
        type: 'line',
        data: chartData.map(record => record.connections_udp ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.tertiary },
      },
    ],
  }

  const processChartOption: EChartsOption = {
    animation: false,
    color: [chartColors.quaternary],
    tooltip: {
      ...baseTooltipConfig,
      formatter: (params: unknown) => {
        const items = normalizeTooltipParams(params)
        const firstParam = items[0]
        if (!firstParam)
          return ''
        const record = chartData[firstParam.dataIndex]
        if (!record)
          return ''

        const value = asNumber(firstParam.value)
        const timeStr = formatTimeForTooltip(record.time, selectedHours || 1)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'
        html += `<div style="display:flex;align-items:center">${colorDot(firstParam.color)}<span>进程数</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${value != null ? Math.round(value) : '-'}</span></div>`
        html += '</div>'
        return html
      },
    },
    grid: chartMargin,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: '进程',
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      min: 0,
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => Math.round(val).toString(),
      },
    },
    series: [
      {
        name: '进程数',
        type: 'line',
        data: chartData.map(record => record.process ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.quaternary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(167, 139, 250, 0.25)' },
              { offset: 1, color: 'rgba(167, 139, 250, 0.02)' },
            ],
          },
        },
      },
    ],
  }

  return (
    <div className={`flex flex-col gap-4 ${className ?? ''}`}>
      <Tabs value={activeView} onValueChange={value => setSelectedView(String(value))} className="w-full items-center">
        <div className="min-w-0 flex-1 overflow-x-auto rounded-sm">
          <TabsList aria-label="负载历史时间段">
            {availableViews.map(view => (
              <TabsTab key={view.label} value={view.label}>
                {view.label}
              </TabsTab>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {loading
        ? <ChartSkeletonGrid />
        : error
          ? <div className="py-8 text-center text-red-500">{error}</div>
          : remoteData.length === 0
            ? <Empty description="暂无负载数据" />
            : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ChartCard
                    title="CPU"
                    headerValue={(
                      latestStatus?.cpu != null
                        ? (
                            <span className="flex items-baseline gap-0.5">
                              <span>{latestStatus.cpu.toFixed(1)}</span>
                              <span>%</span>
                            </span>
                          )
                        : '-'
                    )}
                    option={cpuChartOption}
                  />

                  <ChartCard
                    title="内存"
                    headerValue={(
                      <span className="flex items-baseline gap-1">
                        <span>{formatBytesBrief(latestStatus?.ram)}</span>
                        <span>·</span>
                        <span>{formatBytesBrief(latestStatus?.ram_total ?? nodeInfo?.mem_total)}</span>
                      </span>
                    )}
                    option={memoryChartOption}
                  />

                  <ChartCard
                    title="磁盘"
                    headerValue={(
                      <span className="flex items-baseline gap-1">
                        <span>{formatBytesBrief(latestStatus?.disk)}</span>
                        <span>·</span>
                        <span>{formatBytesBrief(latestStatus?.disk_total ?? nodeInfo?.disk_total)}</span>
                      </span>
                    )}
                    option={diskChartOption}
                  />

                  <ChartCard
                    title="网络"
                    headerValue={(
                      <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                        <span className="flex items-center gap-0.5">
                          <Icon icon="tabler:chevron-up" width={12} height={12} />
                          {formatBytesBrief(latestStatus?.net_out, '/s')}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Icon icon="tabler:chevron-down" width={12} height={12} />
                          {formatBytesBrief(latestStatus?.net_in, '/s')}
                        </span>
                      </span>
                    )}
                    option={networkChartOption}
                  />

                  <ChartCard
                    title="连接"
                    headerValue={(
                      <span className="flex items-baseline gap-1">
                        <span>
                          TCP:
                          {latestStatus?.connections ?? '-'}
                        </span>
                        <span>·</span>
                        <span>
                          UDP:
                          {latestStatus?.connections_udp ?? '-'}
                        </span>
                      </span>
                    )}
                    option={connectionsChartOption}
                  />

                  <ChartCard
                    title="进程"
                    headerValue={<span>{latestStatus?.process ?? '-'}</span>}
                    option={processChartOption}
                  />
                </div>
              )}
    </div>
  )
}

function ChartCard({ title, headerValue, option }: { title: string, headerValue: ReactNode, option: EChartsOption }) {
  return (
    <CardX
      header={(
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold tracking-tight">{title}</span>
          <div className="vercel-number min-w-0 text-right text-xs text-foreground/80">{headerValue}</div>
        </div>
      )}
      className="rounded-md bg-card/95"
    >
      <div className="h-48">
        <EChart option={option} />
      </div>
    </CardX>
  )
}

function ChartSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {chartSkeletonItems.map(item => <ChartCardSkeleton key={item} />)}
    </div>
  )
}

function ChartCardSkeleton() {
  return (
    <CardX
      header={(
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-3 w-22" />
        </div>
      )}
      className="rounded-md bg-card/95"
    >
      <div className="relative h-48 overflow-hidden">
        <div className="absolute top-2 bottom-6 left-0 flex w-7 flex-col justify-between">
          <Skeleton className="h-2 w-5 rounded-full opacity-65" />
          <Skeleton className="h-2 w-4 rounded-full opacity-55" />
          <Skeleton className="h-2 w-5 rounded-full opacity-45" />
          <Skeleton className="h-2 w-3 rounded-full opacity-40" />
        </div>
        <div className="absolute top-2 right-0 bottom-6 left-9 overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-between">
            <span className="border-t border-dashed border-border/55" />
            <span className="border-t border-dashed border-border/40" />
            <span className="border-t border-dashed border-border/35" />
            <span className="border-t border-dashed border-border/25" />
          </div>
          <div className="absolute inset-0 flex justify-between">
            <span className="border-l border-border/25" />
            <span className="border-l border-border/15" />
            <span className="border-l border-border/15" />
            <span className="border-l border-border/25" />
          </div>
          <svg className="absolute inset-0 size-full" viewBox="0 0 512 160" preserveAspectRatio="none" aria-hidden="true">
            {loadChartSkeletonPaths.map((path, index) => (
              <path
                key={path}
                d={path}
                className={`komari-skeleton-chart-line komari-skeleton-chart-line-${index + 1}`}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/65 via-transparent to-card/65" />
        </div>
        <div className="absolute right-0 bottom-0 left-9 flex justify-between">
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
        </div>
      </div>
    </CardX>
  )
}
