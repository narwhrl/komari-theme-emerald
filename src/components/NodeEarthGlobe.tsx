'use client'

import type { COBEOptions, Globe, Marker } from 'cobe'
import type { NodeData } from '@/stores/nodes'
import createGlobe from 'cobe'
import { useEffect, useMemo, useRef } from 'react'
import { useAppDerived } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getCoordByCode, getCountryCodeFromRegion } from '@/utils/geoHelper'

interface RegionCluster {
  code: string
  coord: [number, number]
  servers: number
  onlineServers: number
}

const INITIAL_THETA = 0.22
const CHINA_COORD = getCoordByCode('CN') ?? [35.8617, 104.1954]
const DEFAULT_PHI = -Math.PI / 2 - CHINA_COORD[1] * Math.PI / 180

export default function NodeEarthGlobe({
  nodes,
  spinning = true,
  className,
}: {
  nodes?: NodeData[]
  spinning?: boolean
  className?: string
}) {
  const fallbackNodes = useNodesStore(state => state.earthNodes)
  const displayNodes = nodes ?? fallbackNodes
  const { isDark } = useAppDerived()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const globeRef = useRef<Globe | null>(null)
  const phiRef = useRef(DEFAULT_PHI)
  const thetaRef = useRef(INITIAL_THETA)
  const pointerRef = useRef({ down: false, x: 0, y: 0 })

  const clusters = useMemo<RegionCluster[]>(() => {
    const map = new Map<string, RegionCluster>()
    for (const node of displayNodes) {
      const code = getCountryCodeFromRegion(node.region)
      if (!code)
        continue
      const coord = getCoordByCode(code)
      if (!coord)
        continue
      const entry = map.get(code) ?? { code, coord, servers: 0, onlineServers: 0 }
      entry.servers += 1
      entry.onlineServers += node.online ? 1 : 0
      map.set(code, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.servers - a.servers)
  }, [displayNodes])

  const markers = useMemo<Marker[]>(() => clusters.map(cluster => ({
    location: cluster.coord,
    size: 0.03,
  })), [clusters])

  const totalServers = displayNodes.length
  const onlineServers = displayNodes.filter(node => node.online).length
  const offlineServers = totalServers - onlineServers

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return

    let frame = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const colors = isDark
      ? {
          dark: 1,
          mapBrightness: 4,
          baseColor: [0.32, 0.33, 0.4] as [number, number, number],
          markerColor: [0.4, 0.7, 1.0] as [number, number, number],
          glowColor: [0.2, 0.25, 0.45] as [number, number, number],
        }
      : {
          dark: 0,
          mapBrightness: 6,
          baseColor: [1, 1, 1] as [number, number, number],
          markerColor: [0.21, 0.51, 0.93] as [number, number, number],
          glowColor: [1, 1, 1] as [number, number, number],
        }

    const getSize = () => {
      const rect = canvas.getBoundingClientRect()
      return {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      }
    }
    let currentSize = getSize()
    const options: COBEOptions = {
      devicePixelRatio: dpr,
      width: currentSize.width,
      height: currentSize.height,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: colors.dark,
      diffuse: 1.2,
      mapSamples: 10000,
      mapBrightness: colors.mapBrightness,
      baseColor: colors.baseColor,
      markerColor: colors.markerColor,
      glowColor: colors.glowColor,
      markers,
      markerElevation: 0,
    }

    globeRef.current = createGlobe(canvas, options)
    const tick = () => {
      if (spinning && !pointerRef.current.down)
        phiRef.current += 0.0025
      globeRef.current?.update({
        phi: phiRef.current,
        theta: thetaRef.current,
      })
      frame = requestAnimationFrame(tick)
    }
    const resize = () => {
      const nextSize = getSize()
      if (nextSize.width === currentSize.width && nextSize.height === currentSize.height)
        return
      currentSize = nextSize
      globeRef.current?.update({ width: currentSize.width, height: currentSize.height })
    }
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      globeRef.current?.destroy()
      globeRef.current = null
    }
  }, [isDark, markers, spinning])

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    pointerRef.current = { down: true, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointerRef.current.down)
      return
    const deltaX = event.clientX - pointerRef.current.x
    const deltaY = event.clientY - pointerRef.current.y
    pointerRef.current.x = event.clientX
    pointerRef.current.y = event.clientY
    phiRef.current += deltaX / 200
    thetaRef.current = Math.min(Math.max(thetaRef.current + deltaY / 300, -0.65), 0.65)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointerRef.current.down = false
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className={`relative mx-auto aspect-square w-full max-w-md -translate-y-6 md:-translate-y-12 ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab touch-none select-none contain-layout active:cursor-grabbing"
        style={{ width: '100%', height: '100%' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="pointer-events-none absolute inset-x-6 bottom-10 flex flex-wrap justify-center gap-1">
        {clusters.slice(0, 8).map(cluster => (
          <div key={cluster.code} className="flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] backdrop-blur-sm">
            <img src={`/images/flags/${cluster.code}.svg`} alt={cluster.code} className="size-3" />
            {cluster.onlineServers > 0 ? <span className="text-green-600">{cluster.onlineServers}</span> : null}
            {cluster.servers - cluster.onlineServers > 0 ? <span className="text-yellow-600">{cluster.servers - cluster.onlineServers}</span> : null}
          </div>
        ))}
      </div>
      {totalServers > 0
        ? (
            <div className="pointer-events-none absolute top-6 left-0 flex items-center gap-2 rounded bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-lg md:top-12">
              {onlineServers > 0 ? <LegendDot color="green" value={onlineServers} /> : null}
              {offlineServers > 0 ? <LegendDot color="yellow" value={offlineServers} /> : null}
            </div>
          )
        : null}
    </div>
  )
}

function LegendDot({ color, value }: { color: 'green' | 'yellow', value: number }) {
  const dot = color === 'green' ? 'bg-green-600' : 'bg-yellow-600'
  const text = color === 'green' ? 'text-green-600' : 'text-yellow-600'
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block size-1.5 animate-pulse rounded-full ${dot}`} />
      <span className={text}>{value}</span>
    </div>
  )
}
