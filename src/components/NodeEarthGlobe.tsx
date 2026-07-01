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

const GLOBE_RADIUS = 0.8
const INITIAL_THETA = 0.22
const CHINA_COORD = getCoordByCode('CN') ?? [35.8617, 104.1954]
const DEFAULT_PHI = -Math.PI / 2 - CHINA_COORD[1] * Math.PI / 180
const MARKER_LABEL_ANCHOR = 'translate(-12px, -50%)'

function locationToVector([lat, lng]: [number, number]): [number, number, number] {
  const latitude = lat * Math.PI / 180
  const longitude = lng * Math.PI / 180 - Math.PI
  const radius = Math.cos(latitude)
  return [
    -radius * Math.cos(longitude),
    Math.sin(latitude),
    radius * Math.sin(longitude),
  ]
}

function projectLocation(coord: [number, number], phi: number, theta: number, width: number, height: number) {
  const point = locationToVector(coord).map(value => value * GLOBE_RADIUS) as [number, number, number]
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const x = cosPhi * point[0] + sinPhi * point[2]
  const y = sinPhi * sinTheta * point[0] + cosTheta * point[1] - cosPhi * sinTheta * point[2]
  const z = -sinPhi * cosTheta * point[0] + sinTheta * point[1] + cosPhi * cosTheta * point[2]
  const visible = z >= 0 || x * x + y * y >= GLOBE_RADIUS * GLOBE_RADIUS

  return {
    x: ((x / (width / height)) + 1) / 2 * width,
    y: (-y + 1) / 2 * height,
    visible,
  }
}

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
  const labelMapRef = useRef(new Map<string, HTMLDivElement>())
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

    const updateMarkerLabels = () => {
      for (const cluster of clusters.slice(0, 8)) {
        const label = labelMapRef.current.get(cluster.code)
        if (!label)
          continue

        const position = projectLocation(cluster.coord, phiRef.current, thetaRef.current, currentSize.width, currentSize.height)
        label.style.opacity = position.visible ? '1' : '0'
        label.style.filter = position.visible ? 'blur(0)' : 'blur(4px)'
        label.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) ${MARKER_LABEL_ANCHOR}`
      }
    }

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
      updateMarkerLabels()
      frame = requestAnimationFrame(tick)
    }
    const resize = () => {
      const nextSize = getSize()
      if (nextSize.width === currentSize.width && nextSize.height === currentSize.height)
        return
      currentSize = nextSize
      globeRef.current?.update({ width: currentSize.width, height: currentSize.height })
      updateMarkerLabels()
    }
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      globeRef.current?.destroy()
      globeRef.current = null
    }
  }, [clusters, isDark, markers, spinning])

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
      <div className="pointer-events-none absolute inset-0 z-10">
        {clusters.slice(0, 8).map(cluster => (
          <div
            key={cluster.code}
            ref={(element) => {
              if (element)
                labelMapRef.current.set(cluster.code, element)
              else
                labelMapRef.current.delete(cluster.code)
            }}
            className="absolute top-0 left-0 flex items-center gap-1 rounded border border-border bg-background/90 px-1.5 py-0.5 text-[10px] opacity-0 shadow-xs backdrop-blur-sm transition-[opacity,filter] duration-200 ease-out will-change-transform"
            style={{ transform: `translate3d(-999px, -999px, 0) ${MARKER_LABEL_ANCHOR}` }}
          >
            <img src={`/images/flags/${cluster.code}.svg`} alt={cluster.code} className="size-3" />
            {cluster.onlineServers > 0 ? <span className="text-emerald-600 dark:text-emerald-400">{cluster.onlineServers}</span> : null}
            {cluster.servers - cluster.onlineServers > 0 ? <span className="text-yellow-600">{cluster.servers - cluster.onlineServers}</span> : null}
          </div>
        ))}
      </div>
      {totalServers > 0
        ? (
            <div className="pointer-events-none absolute top-6 left-0 flex items-center gap-2 rounded border border-border bg-background/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-xs md:top-12">
              {onlineServers > 0 ? <LegendDot color="green" value={onlineServers} /> : null}
              {offlineServers > 0 ? <LegendDot color="yellow" value={offlineServers} /> : null}
            </div>
          )
        : null}
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
