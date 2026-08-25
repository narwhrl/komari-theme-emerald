'use client'

import type { EChartsOption } from 'echarts'
import type { ReactNode } from 'react'
import type { Lang, Translate } from '@/i18n'
import type { LoadRangeSelection } from '@/utils/chartRange'
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
import { useI18n } from '@/composables/useI18n'
import { useAppDerived, useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import {
  getEffectiveRangeSelection,
  getLoadRangeCandidates,
  getLoadRangeTabValue,
  parseLoadRangeTabValue,
} from '@/utils/chartRange'
import { getDisplayErrorMessage } from '@/utils/displayError'
import { formatBytesSplit, formatBytesWithConfig, formatDateTime, formatTemperature, isTemperatureAvailable } from '@/utils/helper'
import { fillMissingTimePoints } from '@/utils/recordHelper'
import { getSharedRpc } from '@/utils/rpc'

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
  seriesId?: string | number
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

function formatLoadRangeLabel(hours: number, t: Translate): string {
  return hours % 24 === 0
    ? t('range.days', { count: Math.floor(hours / 24) })
    : t('range.hours', { count: hours })
}

function formatChartAxisTime(time: string, showDate: boolean, lang: Lang): string {
  return formatDateTime(time, showDate ? 'chart' : 'time', lang)
}

function formatChartTooltipTime(time: string, hours: number, lang: Lang): string {
  return formatDateTime(time, hours < 24 ? 'time' : 'chart', lang)
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

function seriesIdOf(item: ChartTooltipParam): string {
  return typeof item.seriesId === 'string' || typeof item.seriesId === 'number'
    ? String(item.seriesId)
    : ''
}

async function queryLoadRecords(uuid: string, hours: LoadRangeSelection): Promise<StatusRecord[]> {
  const rpc = getSharedRpc()
  const result = hours === null
    ? await rpc.getNodeRecentStatus(uuid, 150)
    : await rpc.getLoadRecords(uuid, hours)
  return normalizeLoadRecordsResponse(result, uuid)
    .sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())
}

export default function LoadChart({ uuid, className }: { uuid: string, className?: string }) {
  const publicSettings = useAppStore(state => state.publicSettings)
  const byteDecimals = useAppStore(state => state.byteDecimals)
  const nodeInfo = useNodesStore(state => state.nodes.find(node => node.uuid === uuid))
  const { isDark } = useAppDerived()
  const { lang, t } = useI18n()
  const dataUpdateInterval = useMemo(() => {
    const interval = publicSettings?.theme_settings?.dataUpdateInterval
    return typeof interval === 'number' && interval >= 1 && interval <= 60 ? interval * 1000 : 3000
  }, [publicSettings?.theme_settings])
  const rangeCandidates = useMemo(
    () => getLoadRangeCandidates(publicSettings?.record_preserve_time),
    [publicSettings?.record_preserve_time],
  )
  const [rangeState, setRangeState] = useState<{
    candidates: readonly LoadRangeSelection[]
    selectedHours: LoadRangeSelection
  }>(() => ({ candidates: rangeCandidates, selectedHours: null }))
  if (rangeState.candidates !== rangeCandidates) {
    setRangeState({
      candidates: rangeCandidates,
      selectedHours: getEffectiveRangeSelection(rangeCandidates, rangeState.selectedHours),
    })
  }
  const effectiveHours = getEffectiveRangeSelection(rangeCandidates, rangeState.selectedHours)
  const isRealtime = effectiveHours === null
  const tooltipHours = effectiveHours ?? 1
  const [remoteData, setRemoteData] = useState<StatusRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchRecords() {
      if (!uuid)
        return

      setLoading(true)
      setError(null)

      try {
        const records = await queryLoadRecords(uuid, effectiveHours)
        if (!cancelled)
          setRemoteData(isRealtime ? records.slice(-150) : records)
      }
      catch (err) {
        if (!cancelled) {
          setError(err)
          setRemoteData([])
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
  }, [effectiveHours, isRealtime, uuid])

  useEffect(() => {
    if (!isRealtime)
      return

    let cancelled = false
    const interval = window.setInterval(() => {
      void (async () => {
        if (!uuid)
          return
        setError(null)
        try {
          const records = await queryLoadRecords(uuid, null)
          if (!cancelled)
            setRemoteData(records.slice(-150))
        }
        catch (err) {
          if (!cancelled) {
            setError(err)
            setRemoteData([])
          }
        }
      })()
    }, dataUpdateInterval)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [dataUpdateInterval, isRealtime, uuid])

  const chartData = useMemo(() => {
    const records = statusToRecordFormat(remoteData)
    if (!records.length || isRealtime)
      return records

    const hours = effectiveHours ?? 4
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
  }, [effectiveHours, isRealtime, remoteData])

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

  const showDateInAxis = tooltipHours >= 24
  const formatBytesValue = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? formatBytesWithConfig(value, byteDecimals) : '-'
  const formatBytesBrief = (value: number | null | undefined, suffix = '') => {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return '-'
    const formatted = formatBytesSplit(value, byteDecimals)
    return `${formatted.value} ${formatted.unit}${suffix}`
  }

  const temperatureSeries: Array<number | null> = []
  let lastValidTemperature: number | null = null
  for (const record of chartData) {
    const temperature = isTemperatureAvailable(record.temp) ? record.temp : null
    temperatureSeries.push(temperature)
    if (temperature != null)
      lastValidTemperature = temperature
  }
  const hasTemperature = lastValidTemperature != null

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
    data: chartData.map(record => formatChartAxisTime(record.time, showDateInAxis, lang)),
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

        const timeStr = formatChartTooltipTime(record.time, tooltipHours, lang)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          const value = asNumber(item.value)
          const seriesId = seriesIdOf(item)
          if (seriesId === 'cpu') {
            html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>CPU</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatNullableFixed(value, 1)}%</span></div>`
          }
          else if (seriesId === 'load') {
            html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>${t('load.systemLoad')}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatNullableFixed(value, 2)}</span></div>`
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
        name: t('load.systemLoad'),
        nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 0, 0, 40] },
        min: 0,
        splitLine: { show: false },
      },
    ],
    series: [
      {
        id: 'cpu',
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
        id: 'load',
        name: t('load.systemLoad'),
        type: 'line',
        data: chartData.map(record => record.load),
        showSymbol: false,
        yAxisIndex: 1,
        lineStyle: { width: 1.5, color: chartColors.secondary },
      },
    ],
  }

  const temperatureChartOption: EChartsOption = {
    animation: false,
    color: [chartColors.secondary],
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

        const timeStr = formatChartTooltipTime(record.time, tooltipHours, lang)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'
        html += `<div style="display:flex;align-items:center">${colorDot(firstParam.color)}<span>${t('node.temperature')}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatTemperature(record.temp)}</span></div>`
        html += '</div>'
        return html
      },
    },
    grid: chartMargin,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: t('node.temperature'),
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      min: 0,
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: '{value}°',
      },
    },
    series: [
      {
        id: 'temp',
        name: t('node.temperature'),
        type: 'line',
        data: temperatureSeries,
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.secondary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 179, 71, 0.25)' },
              { offset: 1, color: 'rgba(255, 179, 71, 0.02)' },
            ],
          },
        },
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

        const timeStr = formatChartTooltipTime(record.time, tooltipHours, lang)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          const seriesId = seriesIdOf(item)
          if (seriesId === 'ram') {
            html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>RAM</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatBytesValue(ramUsed)} (${ramPercent}%)</span></div>`
          }
          else if (seriesId === 'swap') {
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
      name: t('load.memory'),
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => formatBytesValue(val),
      },
    },
    series: [
      {
        id: 'ram',
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
        id: 'swap',
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
        const timeStr = formatChartTooltipTime(record.time, tooltipHours, lang)

        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'
        html += `<div style="display:flex;align-items:center">${colorDot(firstParam.color)}<span>${t('load.diskUsed')}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatBytesValue(diskUsed)} (${diskPercent}%)</span></div>`
        html += '</div>'
        return html
      },
    },
    grid: chartMargin,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: t('load.disk'),
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => formatBytesValue(val),
      },
    },
    series: [
      {
        id: 'disk',
        name: t('load.diskUsed'),
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

  const downloadLabel = t('load.download')
  const uploadLabel = t('load.upload')
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

        const timeStr = formatChartTooltipTime(record.time, tooltipHours, lang)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          const value = asNumber(item.value)
          const seriesId = seriesIdOf(item)
          if (seriesId !== 'download' && seriesId !== 'upload')
            continue
          const label = seriesId === 'download' ? `↓ ${downloadLabel}` : `↑ ${uploadLabel}`
          html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>${label}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${formatBytesValue(value)}/s</span></div>`
        }
        html += '</div>'
        return html
      },
    },
    legend: {
      data: [downloadLabel, uploadLabel],
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
      name: t('load.speed'),
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => formatBytesValue(val),
      },
    },
    series: [
      {
        id: 'download',
        name: downloadLabel,
        type: 'line',
        data: chartData.map(record => record.net_in ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.quinary },
      },
      {
        id: 'upload',
        name: uploadLabel,
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

        const timeStr = formatChartTooltipTime(record.time, tooltipHours, lang)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        for (const item of items) {
          const value = asNumber(item.value)
          const seriesId = seriesIdOf(item)
          if (seriesId !== 'tcp' && seriesId !== 'udp')
            continue
          const label = seriesId === 'tcp' ? 'TCP' : 'UDP'
          html += `<div style="display:flex;align-items:center">${colorDot(item.color)}<span>${label}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${value != null ? Math.round(value) : '-'}</span></div>`
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
      name: t('load.connectionCount'),
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      min: 0,
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => Math.round(val).toString(),
      },
    },
    series: [
      {
        id: 'tcp',
        name: 'TCP',
        type: 'line',
        data: chartData.map(record => record.connections ?? null),
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartColors.primary },
      },
      {
        id: 'udp',
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
        const timeStr = formatChartTooltipTime(record.time, tooltipHours, lang)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'
        html += `<div style="display:flex;align-items:center">${colorDot(firstParam.color)}<span>${t('load.processCount')}</span><span style="margin-left:auto;font-weight:600;margin-left:16px">${value != null ? Math.round(value) : '-'}</span></div>`
        html += '</div>'
        return html
      },
    },
    grid: chartMargin,
    xAxis: baseXAxisConfig,
    yAxis: {
      ...baseYAxisConfig,
      name: t('load.process'),
      nameTextStyle: { color: chartThemeColors.textSecondary, padding: [0, 40, 0, 0] },
      min: 0,
      axisLabel: {
        ...baseYAxisConfig.axisLabel,
        formatter: (val: number) => Math.round(val).toString(),
      },
    },
    series: [
      {
        id: 'process',
        name: t('load.processCount'),
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
      <Tabs
        value={getLoadRangeTabValue(effectiveHours)}
        onValueChange={(value) => {
          const next = parseLoadRangeTabValue(String(value))
          if (next !== undefined)
            setRangeState({ candidates: rangeCandidates, selectedHours: next })
        }}
        className="w-full items-center"
      >
        <div className="min-w-0 flex-1 overflow-x-auto rounded-sm">
          <TabsList aria-label={t('load.rangeLabel')}>
            {rangeCandidates.map((hours) => {
              const value = getLoadRangeTabValue(hours)
              return (
                <TabsTab key={value} value={value}>
                  {hours === null ? t('load.realtime') : formatLoadRangeLabel(hours, t)}
                </TabsTab>
              )
            })}
          </TabsList>
        </div>
      </Tabs>

      {loading
        ? <ChartSkeletonGrid loadingLabel={t('common.loading')} />
        : error != null
          ? <div className="py-8 text-center text-destructive-foreground">{getDisplayErrorMessage(error, t('load.failed'))}</div>
          : remoteData.length === 0
            ? <Empty description={t('load.empty')} />
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

                  {hasTemperature
                    ? (
                        <ChartCard
                          title={t('node.temperature')}
                          headerValue={<span>{formatTemperature(lastValidTemperature)}</span>}
                          option={temperatureChartOption}
                        />
                      )
                    : null}

                  <ChartCard
                    title={t('load.memory')}
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
                    title={t('load.disk')}
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
                    title={t('load.network')}
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
                    title={t('load.connections')}
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
                    title={t('load.process')}
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
      className="rounded-2xl bg-card"
    >
      <div className="h-48">
        <EChart option={option} />
      </div>
    </CardX>
  )
}

function ChartSkeletonGrid({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={loadingLabel}>
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
      className="rounded-2xl bg-card"
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
