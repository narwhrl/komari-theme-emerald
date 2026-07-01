"use client";

import createGlobe, { type COBEOptions, type Globe, type Marker } from "cobe";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNodesStore, type NodeData } from "@/stores/nodes";
import { useAppStore } from "@/stores/app";
import { getCoordByCode, getCountryCodeFromRegion } from "@/utils/geoHelper";

interface NodeEarthGlobeProps {
  nodes?: NodeData[];
  className?: string;
}

interface RegionCluster {
  code: string;
  coord: [number, number];
  servers: number;
  onlineServers: number;
}

const INITIAL_THETA = 0.22;
const MIN_THETA = -0.65;
const MAX_THETA = 0.65;
const CHINA_COORD = getCoordByCode("CN") ?? [35.8617, 104.1954];
const DEFAULT_PHI = normalizePhi(-Math.PI / 2 - (CHINA_COORD[1] * Math.PI) / 180);
const GLOBE_RADIUS = 0.8;
const GLOBE_SCALE = 1;
const MARKER_ELEVATION = 0;
const ORIENTATION_IDLE_EPSILON = 1e-5;

function normalizePhi(value: number): number {
  const circle = Math.PI * 2;
  let next = value % circle;
  if (next <= -Math.PI) next += circle;
  if (next > Math.PI) next -= circle;
  return next;
}

function clampTheta(value: number): number {
  return Math.min(Math.max(value, MIN_THETA), MAX_THETA);
}

function getCappedDpr(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

function coordToGlobePoint([lat, lon]: [number, number]): [number, number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180 - Math.PI;
  const cosLat = Math.cos(latRad);
  return [-cosLat * Math.cos(lonRad), Math.sin(latRad), cosLat * Math.sin(lonRad)];
}

export function NodeEarthGlobe({ nodes, className }: NodeEarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useThemeDark();
  const earthNodes = useNodesStore((s) => s.earthNodes);
  const earthViewMode = useAppStore((s) => s.getEarthViewMode());
  const shouldAutoRotate = earthViewMode !== "earth-stop";
  const displayNodes = nodes ?? earthNodes;

  const regionClusters = useMemo<RegionCluster[]>(() => {
    const map = new Map<string, RegionCluster>();
    for (const node of displayNodes) {
      const code = getCountryCodeFromRegion(node.region);
      if (!code) continue;
      const coord = getCoordByCode(code);
      if (!coord) continue;
      let entry = map.get(code);
      if (!entry) {
        entry = { code, coord, servers: 0, onlineServers: 0 };
        map.set(code, entry);
      }
      entry.servers += 1;
      if (node.online) entry.onlineServers += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.servers - a.servers);
  }, [displayNodes]);

  const markers = useMemo<Marker[]>(
    () => regionClusters.map((c) => ({ location: c.coord, size: 0 })),
    [regionClusters],
  );

  const themeColors = useMemo(() => {
    if (isDark) {
      return {
        dark: 1,
        mapBrightness: 4,
        baseColor: [0.32, 0.33, 0.4] as [number, number, number],
        markerColor: [0.4, 0.7, 1.0] as [number, number, number],
        glowColor: [0.2, 0.25, 0.45] as [number, number, number],
      };
    }
    return {
      dark: 0,
      mapBrightness: 6,
      baseColor: [1, 1, 1] as [number, number, number],
      markerColor: [0.21, 0.51, 0.93] as [number, number, number],
      glowColor: [1, 1, 1] as [number, number, number],
    };
  }, [isDark]);

  const [size, setSize] = useState({ width: 320, height: 320 });
  const overlayRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const rect = e.contentRect;
        setSize({ width: rect.width, height: rect.height });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Set up globe
  const stateRef = useRef({
    globe: null as Globe | null,
    phi: DEFAULT_PHI,
    targetPhi: DEFAULT_PHI,
    theta: INITIAL_THETA,
    targetTheta: INITIAL_THETA,
    isPointerDown: false,
    lastX: 0,
    lastY: 0,
    staticRedrawUntil: 0,
  });

  const syncClusterOverlays = useCallback(() => {
    for (const cluster of regionClusters) {
      const el = overlayRefs.current.get(cluster.code);
      if (el)
        projectOverlay(
          cluster,
          el,
          size,
          stateRef.current.phi,
          stateRef.current.theta,
        );
    }
    // Intentionally exclude stateRef (a ref) from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionClusters, size]);

  useEffect(() => {
    syncClusterOverlays();
  }, [syncClusterOverlays]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const colors = themeColors;
    const initialOptions: COBEOptions = {
      devicePixelRatio: getCappedDpr(),
      width: size.width,
      height: size.height,
      phi: stateRef.current.phi,
      theta: stateRef.current.theta,
      dark: colors.dark,
      diffuse: 1.2,
      mapSamples: 10000,
      mapBrightness: colors.mapBrightness,
      baseColor: colors.baseColor,
      markerColor: colors.markerColor,
      glowColor: colors.glowColor,
      markers,
      markerElevation: MARKER_ELEVATION,
    };
    const globe = createGlobe(canvasRef.current, initialOptions);
    stateRef.current.globe = globe;
    syncClusterOverlays();
    const state = stateRef.current;
    return () => {
      globe.destroy();
      if (state.globe === globe) state.globe = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild on theme change
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!stateRef.current.globe) return;
    stateRef.current.globe.destroy();
    const colors = themeColors;
    stateRef.current.globe = createGlobe(canvasRef.current, {
      devicePixelRatio: getCappedDpr(),
      width: size.width,
      height: size.height,
      phi: stateRef.current.phi,
      theta: stateRef.current.theta,
      dark: colors.dark,
      diffuse: 1.2,
      mapSamples: 10000,
      mapBrightness: colors.mapBrightness,
      baseColor: colors.baseColor,
      markerColor: colors.markerColor,
      glowColor: colors.glowColor,
      markers,
      markerElevation: MARKER_ELEVATION,
    });
    syncClusterOverlays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeColors, markers, size.width, size.height, syncClusterOverlays]);

  // Update markers
  useEffect(() => {
    stateRef.current.globe?.update({ markers });
    syncClusterOverlays();
  }, [markers, syncClusterOverlays]);

  // RAF loop for rotation
  useEffect(() => {
    let raf = 0;
    function loop() {
      const s = stateRef.current;
      if (s.globe) {
        const prevPhi = s.phi;
        const prevTheta = s.theta;
        if (!s.isPointerDown && shouldAutoRotate) s.targetPhi += 0.0025;
        s.phi += (s.targetPhi - s.phi) * 1;
        s.theta += (s.targetTheta - s.theta) * 1;
        if (
          Math.abs(s.phi - prevPhi) >= ORIENTATION_IDLE_EPSILON ||
          Math.abs(s.theta - prevTheta) >= ORIENTATION_IDLE_EPSILON
        ) {
          s.globe.update({ phi: s.phi, theta: s.theta, width: size.width, height: size.height });
          syncClusterOverlays();
        }
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoRotate, size.width, size.height]);

  // Pointer handlers
  function onPointerDown(e: React.PointerEvent) {
    const s = stateRef.current;
    s.isPointerDown = true;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = stateRef.current;
    if (!s.isPointerDown) return;
    const dx = e.clientX - s.lastX;
    const dy = e.clientY - s.lastY;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.targetPhi += dx / 200;
    s.targetTheta = clampTheta(s.targetTheta + dy / 300);
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = stateRef.current;
    s.isPointerDown = false;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  }

  const totalServers = displayNodes.length;
  const onlineServers = displayNodes.filter((n) => n.online).length;
  const offlineServers = totalServers - onlineServers;

  return (
    <div
      ref={containerRef}
      className={`relative aspect-square w-full max-w-md mx-auto -translate-y-6 md:-translate-y-12 ${className ?? ""}`}
    >
      <canvas
        ref={canvasRef}
        className="earth-globe-canvas absolute inset-0 w-full h-full select-none touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {regionClusters.map((cluster) => (
        <div
          key={cluster.code}
          ref={(el) => {
            if (el) overlayRefs.current.set(cluster.code, el);
            else overlayRefs.current.delete(cluster.code);
          }}
          className="absolute -top-3.5 left-0 pointer-events-none rounded backdrop-blur-sm transition-[opacity,filter] duration-500"
        >
          <img
            src={`/images/flags/${cluster.code}.svg`}
            alt={cluster.code}
            className="size-4 block absolute -bottom-2 -left-2 z-1"
          />
          <div className="relative z-2 bg-background/60 rounded py-0.5 px-2 text-xs zoom-80 items-start justify-center text-nowrap">
            {cluster.onlineServers > 0 && (
              <div className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-green-600" />
                <span className="text-green-600">{cluster.onlineServers}</span>
              </div>
            )}
            {cluster.servers - cluster.onlineServers > 0 && (
              <div className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-yellow-600" />
                <span className="text-yellow-600">{cluster.servers - cluster.onlineServers}</span>
              </div>
            )}
          </div>
        </div>
      ))}
      {totalServers > 0 && (
        <div className="absolute top-6 md:top-12 left-0 text-[10px] text-muted-foreground pointer-events-none flex gap-2 items-center backdrop-blur-lg bg-background/60 rounded px-2 py-0.5">
          {onlineServers > 0 && (
            <div className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-green-600 animate-pulse" />
              <span className="text-green-600">{onlineServers}</span>
            </div>
          )}
          {offlineServers > 0 && (
            <div className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-yellow-600 animate-pulse" />
              <span className="text-yellow-600">{offlineServers}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function projectOverlay(
  cluster: RegionCluster,
  el: HTMLDivElement,
  size: { width: number; height: number },
  phi: number,
  theta: number,
) {
  const { width, height } = size;
  if (width <= 0 || height <= 0) {
    el.style.opacity = "0";
    el.style.filter = "blur(20px)";
    return;
  }
  const aspect = width / height;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const markerRadius = GLOBE_RADIUS + MARKER_ELEVATION;
  const visibleThreshold = GLOBE_RADIUS * GLOBE_RADIUS;
  const [baseX, baseY, baseZ] = coordToGlobePoint(cluster.coord);
  const x = baseX * markerRadius;
  const y = baseY * markerRadius;
  const z = baseZ * markerRadius;
  const screenX = cosPhi * x + sinPhi * z;
  const screenY = sinPhi * sinTheta * x + cosTheta * y - cosPhi * sinTheta * z;
  const visible =
    -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z >= 0 ||
    screenX * screenX + screenY * screenY >= visibleThreshold;
  const xPx = ((screenX / aspect) * GLOBE_SCALE + 1) * width / 2;
  const yPx = ((-screenY) * GLOBE_SCALE + 1) * height / 2;
  el.style.transform = `translate3d(${xPx}px, ${yPx}px, 0)`;
  el.style.opacity = visible ? "1" : "0";
  el.style.filter = visible ? "blur(0px)" : "blur(20px)";
}

function useThemeDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    setDark(document.documentElement.classList.contains("dark"));
    return () => obs.disconnect();
  }, []);
  return dark;
}

export default NodeEarthGlobe;