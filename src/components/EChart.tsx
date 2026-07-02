'use client'

import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts/core'
import { useEffect, useRef } from 'react'
import '@/utils/echarts'

export default function EChart({ option, className }: { option: EChartsOption, className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current)
      return
    const chart = echarts.init(ref.current)
    chartRef.current = chart
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  return <div ref={ref} className={className ?? 'h-full w-full'} />
}
