"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Empty } from "@/components/ui/EmptyCompat";
import { Spinner } from "@/components/ui/spinner";
import { useNodesStore, type NodeData } from "@/stores/nodes";
import { useAppStore } from "@/stores/app";
import { ensureWorldMapRegistered } from "@/utils/echartsWorldMap";
import { getCoordByCode, getCountryCodeFromRegion } from "@/utils/geoHelper";
import { getRegionDisplayName } from "@/utils/regionHelper";
import "@/utils/echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface NodeEarthMapsProps {
  nodes?: NodeData[];
  className?: string;
}

interface EarthMapPoint {
  code: string;
  name: string;
  coord: [number, number];
  online: number;
  total: number;
}

export function NodeEarthMaps({ nodes, className }: NodeEarthMapsProps) {
  const isDark = useThemeDarkProxy();
  const earthNodes = useNodesStore((s) => s.earthNodes);
  const displayNodes = nodes ?? earthNodes;
  const [mapName, setMapName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const name = await ensureWorldMapRegistered();
        if (!cancelled) setMapName(name);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "地图资源加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const points = useMemo<EarthMapPoint[]>(() => {
    const map = new Map<string, EarthMapPoint>();
    for (const node of displayNodes) {
      const code = getCountryCodeFromRegion(node.region);
      if (!code) continue;
      const coord = getCoordByCode(code);
      if (!coord) continue;
      const current = map.get(code);
      if (!current) {
        map.set(code, {
          code,
          name: getRegionDisplayName(node.region),
          coord,
          online: node.online ? 1 : 0,
          total: 1,
        });
        continue;
      }
      current.total += 1;
      current.online += node.online ? 1 : 0;
    }
    return Array.from(map.values()).sort((a, b) => b.online - a.online || b.total - a.total);
  }, [displayNodes]);

  const chartOption = useMemo(() => {
    const activeColor = isDark ? "rgba(16,185,129,0.52)" : "rgba(16,185,129,0.36)";
    const activeBorder = isDark ? "rgba(16,185,129,0.95)" : "rgba(5,150,105,0.92)";
    const offlineColor = isDark ? "rgba(234,179,8,0.32)" : "rgba(202,138,4,0.22)";
    const offlineBorder = isDark ? "rgba(234,179,8,0.8)" : "rgba(202,138,4,0.88)";
    const areaColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
    const borderColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";

    return {
      animationDurationUpdate: 300,
      animationEasingUpdate: "cubicOut",
      series: [
        {
          type: "map",
          map: mapName ?? "",
          roam: false,
          selectedMode: false,
          left: "center",
          top: "center",
          width: "100%",
          height: "100%",
          layoutCenter: ["50%", "50%"],
          layoutSize: "168%",
          label: { show: false },
          emphasis: {
            label: { show: false },
            itemStyle: {
              areaColor: borderColor,
              borderColor: isDark ? "rgba(16,185,129,0.9)" : "rgba(5,150,105,0.85)",
              borderWidth: 0.5,
            },
          },
          itemStyle: {
            areaColor,
            borderColor,
            borderWidth: 0.5,
          },
          data: points.map((p) => ({
            name: p.code,
            value: p.total,
            itemStyle: {
              areaColor: p.online > 0 ? activeColor : offlineColor,
              borderColor: p.online > 0 ? activeBorder : offlineBorder,
              borderWidth: 0.5,
            },
            emphasis: {
              itemStyle: {
                areaColor: p.online > 0 ? activeColor : offlineColor,
                borderColor: p.online > 0 ? activeBorder : offlineBorder,
              },
            },
          })),
        },
      ],
    };
  }, [points, isDark, mapName]);

  const totalServers = displayNodes.length;
  const onlineServers = displayNodes.filter((n) => n.online).length;
  const offlineServers = totalServers - onlineServers;

  return (
    <div className={`relative h-full border-none ${className ?? ""}`}>
      <div className="relative flex h-88 flex-col items-center">
        {totalServers > 0 && (
          <div className="absolute top-0 right-0 z-2 text-[10px] text-muted-foreground pointer-events-none flex gap-2 items-center backdrop-blur-lg bg-background/60 rounded px-2 py-0.5">
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
        <div className="relative flex-1 w-full -translate-y-1/6">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <Spinner />
            </div>
          ) : loadError ? (
            <Empty description="地图资源加载失败" />
          ) : mapName ? (
            <ReactECharts
              option={chartOption}
              style={{ height: "100%", width: "100%" }}
              notMerge
              lazyUpdate
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function useThemeDarkProxy(): boolean {
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

export default NodeEarthMaps;