'use client'

import type { Arc, COBEOptions, Globe, Marker } from 'cobe'
import type { NodeData } from '@/stores/nodes'
import createGlobe from 'cobe'
import { useEffect, useMemo, useRef } from 'react'
import { useAppDerived, useAppStore } from '@/stores/app'
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
const AUTO_ROTATION_SPEED = 0.0015
const CHINA_COORD = getCoordByCode('CN') ?? [35.8617, 104.1954]
const DEFAULT_PHI = -Math.PI / 2 - CHINA_COORD[1] * Math.PI / 180
const COBE_WRAPPER_UNWRAP_LIMIT = 64
const COBE_WRAPPER_STYLE_WHITESPACE = /\s+/g

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

function getGlobeTheme(isDark: boolean) {
  return isDark
    ? {
        dark: 1,
        mapBrightness: 4,
        baseColor: [0.32, 0.33, 0.4] as [number, number, number],
        markerColor: [0.4, 0.7, 1.0] as [number, number, number],
        glowColor: [0.2, 0.25, 0.45] as [number, number, number],
        arcColor: [0.45, 0.75, 1.0] as [number, number, number],
      }
    : {
        dark: 0,
        mapBrightness: 6,
        baseColor: [1, 1, 1] as [number, number, number],
        markerColor: [0.21, 0.51, 0.93] as [number, number, number],
        glowColor: [1, 1, 1] as [number, number, number],
        arcColor: [0.21, 0.51, 0.93] as [number, number, number],
      }
}

function isCobeWrapper(element: Element): boolean {
  if (!(element instanceof HTMLDivElement))
    return false
  if (element.className !== '')
    return false
  const style = element.style.cssText.replaceAll(COBE_WRAPPER_STYLE_WHITESPACE, '')
  return style.includes('position:relative') && style.includes('width:100%') && style.includes('height:100%')
}

function restoreCanvasFromCobeWrapper(canvas: HTMLCanvasElement) {
  for (let index = 0; index < COBE_WRAPPER_UNWRAP_LIMIT; index += 1) {
    const wrapper = canvas.parentElement
    if (!wrapper || !isCobeWrapper(wrapper))
      return
    const host = wrapper.parentElement
    if (!host)
      return
    host.insertBefore(canvas, wrapper)
    if (wrapper.parentNode === host)
      wrapper.remove()
    else
      return
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
  const { isDark, visitorInfoCardEnabled } = useAppDerived()
  const visitorCountryCode = useAppStore(state => state.visitorCountryCode)
  const visitorCoord = useMemo<[number, number] | null>(() => {
    if (!visitorInfoCardEnabled || !visitorCountryCode)
      return null
    return getCoordByCode(visitorCountryCode) ?? null
  }, [visitorCountryCode, visitorInfoCardEnabled])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const globeRef = useRef<Globe | null>(null)
  const labelMapRef = useRef(new Map<string, HTMLDivElement>())
  const phiRef = useRef(DEFAULT_PHI)
  const thetaRef = useRef(INITIAL_THETA)
  const pointerRef = useRef({ down: false, x: 0, y: 0 })
  const reduceMotionRef = useRef(false)
  const clustersRef = useRef<RegionCluster[]>([])
  const spinningRef = useRef(spinning)
  const markersRef = useRef<Marker[]>([])
  const arcsRef = useRef<Arc[]>([])
  const isDarkRef = useRef(isDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncReduceMotion = () => {
      reduceMotionRef.current = media.matches
    }
    syncReduceMotion()
    media.addEventListener('change', syncReduceMotion)
    return () => media.removeEventListener('change', syncReduceMotion)
  }, [])

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
    size: 0,
  })), [clusters])
  const arcs = useMemo<Arc[]>(() => {
    if (!visitorCoord || clusters.length === 0)
      return []
    return clusters.map(cluster => ({ from: visitorCoord, to: cluster.coord }))
  }, [clusters, visitorCoord])

  clustersRef.current = clusters
  spinningRef.current = spinning
  markersRef.current = markers
  arcsRef.current = arcs
  isDarkRef.current = isDark

  const totalServers = displayNodes.length
  const onlineServers = displayNodes.filter(node => node.online).length
  const offlineServers = totalServers - onlineServers

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return

    restoreCanvasFromCobeWrapper(canvas)

    let frame = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const theme = getGlobeTheme(isDarkRef.current)
    const getSize = () => {
      const rect = canvas.getBoundingClientRect()
      return {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      }
    }
    let currentSize = getSize()

    const updateMarkerLabels = () => {
      for (const cluster of clustersRef.current) {
        const label = labelMapRef.current.get(cluster.code)
        if (!label)
          continue

        const position = projectLocation(cluster.coord, phiRef.current, thetaRef.current, currentSize.width, currentSize.height)
        label.style.opacity = position.visible ? '1' : '0'
        label.style.filter = position.visible ? 'blur(0)' : 'blur(20px)'
        label.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
      }
    }

    const options: COBEOptions = {
      devicePixelRatio: dpr,
      width: currentSize.width,
      height: currentSize.height,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: theme.dark,
      diffuse: 1.2,
      mapSamples: 10000,
      mapBrightness: theme.mapBrightness,
      baseColor: theme.baseColor,
      markerColor: theme.markerColor,
      glowColor: theme.glowColor,
      markers: markersRef.current,
      markerElevation: 0,
      arcs: arcsRef.current,
      arcColor: theme.arcColor,
      arcWidth: 0.8,
      arcHeight: 0.4,
    }

    globeRef.current = createGlobe(canvas, options)
    const tick = () => {
      if (spinningRef.current && !pointerRef.current.down && !reduceMotionRef.current)
        phiRef.current += AUTO_ROTATION_SPEED
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
      restoreCanvasFromCobeWrapper(canvas)
    }
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe)
      return
    const theme = getGlobeTheme(isDark)
    globe.update({
      markers,
      arcs,
      dark: theme.dark,
      mapBrightness: theme.mapBrightness,
      baseColor: theme.baseColor,
      markerColor: theme.markerColor,
      glowColor: theme.glowColor,
      arcColor: theme.arcColor,
    })
  }, [arcs, isDark, markers])

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
    <div className={`relative mx-auto aspect-square w-full max-w-md overflow-hidden -translate-y-4 lg:-translate-y-8 ${className ?? ''}`}>
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
        {clusters.map(cluster => (
          <div
            key={cluster.code}
            ref={(element) => {
              if (element)
                labelMapRef.current.set(cluster.code, element)
              else
                labelMapRef.current.delete(cluster.code)
            }}
            className="pointer-events-none absolute -top-3.5 left-0 rounded opacity-0 backdrop-blur-sm transition-[opacity,filter] duration-500 ease-out will-change-transform"
            style={{ transform: 'translate3d(-999px, -999px, 0)' }}
          >
            <img src={`/images/flags/${cluster.code}.svg`} alt={cluster.code} className="absolute -bottom-2 -left-2 z-1 block size-4" />
            <div className="relative z-2 items-start justify-center rounded bg-background/60 px-2 py-0.5 text-xs text-nowrap [zoom:.8]">
              {cluster.onlineServers > 0
                ? (
                    <div className="flex items-center gap-1">
                      <span className="inline-block size-1.5 rounded-full bg-success-foreground" />
                      <span className="text-success-foreground">{cluster.onlineServers}</span>
                    </div>
                  )
                : null}
              {cluster.servers - cluster.onlineServers > 0
                ? (
                    <div className="flex items-center gap-1">
                      <span className="inline-block size-1.5 rounded-full bg-warning-foreground" />
                      <span className="text-warning-foreground">{cluster.servers - cluster.onlineServers}</span>
                    </div>
                  )
                : null}
            </div>
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
  const dot = color === 'green' ? 'bg-success-foreground' : 'bg-warning-foreground'
  const text = color === 'green' ? 'text-success-foreground' : 'text-warning-foreground'
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block size-1.5 animate-pulse rounded-full ${dot}`} />
      <span className={text}>{value}</span>
    </div>
  )
}
