'use client'

import type { EChartsOption } from 'echarts'
import type { NodeData } from '@/stores/nodes'
import * as echarts from 'echarts/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppDerived } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { ensureWorldMapRegistered } from '@/utils/echartsWorldMap'
import { getCountryCodeFromRegion } from '@/utils/geoHelper'
import '@/utils/echarts'

export default function NodeEarthMaps({ nodes, className }: { nodes?: NodeData[], className?: string }) {
  const fallbackNodes = useNodesStore(state => state.earthNodes)
  const displayNodes = nodes ?? fallbackNodes
  const { isDark } = useAppDerived()
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)
  const [mapName, setMapName] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const points = useMemo(() => {
    const map = new Map<string, { code: string, online: number, total: number }>()
    for (const node of displayNodes) {
      const code = getCountryCodeFromRegion(node.region)
      if (!code)
        continue
      const current = map.get(code) ?? { code, online: 0, total: 0 }
      current.total += 1
      current.online += node.online ? 1 : 0
      map.set(code, current)
    }
    return Array.from(map.values()).sort((a, b) => b.online - a.online || b.total - a.total)
  }, [displayNodes])

  const totalServers = displayNodes.length
  const onlineServers = displayNodes.filter(node => node.online).length
  const offlineServers = totalServers - onlineServers

  const option = useMemo<EChartsOption>(() => {
    const colors = {
      areaColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)',
      hoverBorderColor: isDark ? 'rgba(16, 185, 129, 0.9)' : 'rgba(5, 150, 105, 0.85)',
      activeAreaColor: isDark ? 'rgba(16, 185, 129, 0.52)' : 'rgba(16, 185, 129, 0.36)',
      offlineAreaColor: isDark ? 'rgba(234, 179, 8, 0.32)' : 'rgba(202, 138, 4, 0.22)',
      activeBorderColor: isDark ? 'rgba(16, 185, 129, 0.95)' : 'rgba(5, 150, 105, 0.92)',
      offlineBorderColor: isDark ? 'rgba(234, 179, 8, 0.8)' : 'rgba(202, 138, 4, 0.88)',
    }

    return {
      animationDurationUpdate: 300,
      animationEasingUpdate: 'cubicOut',
      series: [
        {
          type: 'map',
          map: mapName,
          roam: false,
          selectedMode: false,
          left: 'center',
          top: 'center',
          width: '100%',
          height: '100%',
          layoutCenter: ['50%', '50%'],
          layoutSize: '168%',
          emphasis: {
            label: { show: false },
            itemStyle: {
              areaColor: colors.borderColor,
              borderColor: colors.hoverBorderColor,
              borderWidth: 0.5,
            },
          },
          itemStyle: {
            areaColor: colors.areaColor,
            borderColor: colors.borderColor,
            borderWidth: 0.5,
          },
          data: points.map(point => ({
            name: point.code,
            value: point.total,
            itemStyle: {
              areaColor: point.online > 0 ? colors.activeAreaColor : colors.offlineAreaColor,
              borderColor: point.online > 0 ? colors.activeBorderColor : colors.offlineBorderColor,
              borderWidth: 0.5,
            },
          })),
          label: { show: false },
        },
      ],
    }
  }, [isDark, mapName, points])

  useEffect(() => {
    ensureWorldMapRegistered()
      .then(setMapName)
      .catch(error => setLoadError(error instanceof Error ? error.message : '地图资源加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!chartRef.current || !mapName)
      return
    const chart = echarts.init(chartRef.current)
    chartInstanceRef.current = chart
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      chart.dispose()
      chartInstanceRef.current = null
    }
  }, [mapName])

  useEffect(() => {
    chartInstanceRef.current?.setOption(option, true)
  }, [option])

  return (
    <div className={`relative h-full ${className ?? ''}`}>
      <div className="relative flex h-88 flex-col items-center">
        {totalServers > 0
          ? (
              <div className="pointer-events-none absolute top-0 right-0 z-2 flex items-center gap-2 rounded border border-border bg-background/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-xs">
                {onlineServers > 0 ? <LegendDot color="green" value={onlineServers} /> : null}
                {offlineServers > 0 ? <LegendDot color="yellow" value={offlineServers} /> : null}
              </div>
            )
          : null}
        <div className="relative w-full flex-1 -translate-y-1/6">
          {loading
            ? (
                <MapSkeleton />
              )
            : mapName
              ? (
                  <div ref={chartRef} className="h-full w-full" />
                )
              : loadError
                ? (
                    <Empty description="地图资源加载失败" className="h-full" />
                  )
                : null}
        </div>
      </div>
    </div>
  )
}

function MapSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Skeleton className="absolute top-0 right-0 h-5 w-20 rounded" />
      <Skeleton className="absolute top-1/2 left-1/2 h-[82%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80" />
      <Skeleton className="absolute top-[34%] left-[28%] h-4 w-12 rounded" />
      <Skeleton className="absolute top-[44%] left-[52%] h-4 w-10 rounded" />
      <Skeleton className="absolute top-[58%] left-[39%] h-4 w-14 rounded" />
    </div>
  )
}

function LegendDot({ color, value }: { color: 'green' | 'yellow', value: number }) {
  const dot = color === 'green' ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-yellow-600'
  const text = color === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600'
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block size-1.5 animate-pulse rounded-full ${dot}`} />
      <span className={text}>{value}</span>
    </div>
  )
}
