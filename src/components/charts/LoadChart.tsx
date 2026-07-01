"use client";

import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/EmptyCompat";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/stores/app";
import { useNodesStore } from "@/stores/nodes";
import { formatBytes, formatBytesSplit } from "@/utils/helper";
import { fillMissingTimePoints, type RecordFormat } from "@/utils/recordHelper";
import { getSharedRpc, type StatusRecord } from "@/utils/rpc";
import "@/utils/echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface LoadChartProps {
  uuid: string;
  className?: string;
}

const CHART_COLORS = {
  primary: "#FF6B6B",
  secondary: "#FFB347",
  tertiary: "#4ECDC4",
  quaternary: "#A78BFA",
  quinary: "#60A5FA",
};

const PRESET_VIEWS = [
  { label: "4 小时", hours: 4 },
  { label: "1 天", hours: 24 },
  { label: "7 天", hours: 168 },
  { label: "30 天", hours: 720 },
];

export function LoadChart({ uuid, className }: LoadChartProps) {
  const appStore = useAppStore();
  const nodesStore = useNodesStore();
  const dataUpdateIntervalMs = useAppStore((s) => {
    const i = s.publicSettings?.theme_settings?.dataUpdateInterval;
    return typeof i === "number" && i >= 1 && i <= 60 ? i * 1000 : 3000;
  });
  const isDark = useThemeDarkProxy();
  const recordPreserve = appStore.publicSettings?.record_preserve_time || 720;

  const [selectedView, setSelectedView] = useState<string>("实时");
  const [data, setData] = useState<StatusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitial, setIsInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nodeInfo = nodesStore.nodesByUuid.get(uuid);

  const isRealtime = selectedView === "实时";
  const selectedHours = useMemo(() => {
    const view = PRESET_VIEWS.find((v) => v.label === selectedView);
    return view?.hours;
  }, [selectedView]);

  const availableViews = useMemo(() => {
    const views: { label: string; hours?: number }[] = [{ label: "实时" }];
    for (const v of PRESET_VIEWS) {
      if (recordPreserve >= v.hours) views.push(v);
    }
    if (recordPreserve > 720) {
      const label =
        recordPreserve % 24 === 0
          ? `${Math.floor(recordPreserve / 24)} 天`
          : `${recordPreserve} 小时`;
      views.push({ label, hours: recordPreserve });
    } else if (recordPreserve > 4 && !PRESET_VIEWS.some((v) => v.hours === recordPreserve)) {
      const label =
        recordPreserve % 24 === 0
          ? `${Math.floor(recordPreserve / 24)} 天`
          : `${recordPreserve} 小时`;
      views.push({ label, hours: recordPreserve });
    }
    return views;
  }, [recordPreserve]);

  async function fetchRecent() {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const rpc = getSharedRpc();
      const result = await rpc.getNodeRecentStatus(uuid);
      const records = (result?.records || []).sort(
        (a: StatusRecord, b: StatusRecord) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf(),
      );
      setData(records.slice(-150));
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取数据失败");
      setData([]);
    } finally {
      setLoading(false);
      setIsInitial(false);
    }
  }

  async function fetchHistory() {
    if (!selectedHours) return;
    setLoading(true);
    setError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "/api";
      const response = await fetch(
        `${apiBase}/records/load?uuid=${uuid}&hours=${selectedHours}`,
      );
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const resp = await response.json();
      const records: StatusRecord[] = (resp.data?.records || []).sort(
        (a: StatusRecord, b: StatusRecord) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf(),
      );
      setData(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取数据失败");
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!uuid) return;
    if (isRealtime) {
      fetchRecent();
      const id = setInterval(fetchRecent, dataUpdateIntervalMs);
      return () => clearInterval(id);
    }
    fetchHistory();
    // refetch when view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, selectedView]);

  const chartData = useMemo<RecordFormat[]>(() => {
    const formatted: RecordFormat[] = data.map((r) => ({
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
    }));

    if (!formatted.length) return [];
    if (isRealtime) return formatted;

    const hours = selectedHours || 4;
    const minute = 60;
    const hour = minute * 60;
    let intervalSec: number;
    let maxGap: number;
    if (hours <= 4) {
      intervalSec = minute;
      maxGap = minute * 2;
    } else if (hours > 120) {
      intervalSec = hour;
      maxGap = hour * 2;
    } else {
      intervalSec = minute * 15;
      maxGap = minute * 30;
    }
    return fillMissingTimePoints(formatted, intervalSec, hours * 3600, maxGap);
  }, [data, isRealtime, selectedHours]);

  const latest = data.at(-1) ?? null;
  const themeColors = useMemo(
    () => ({
      text: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)",
      textSecondary: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
      splitLine: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    }),
    [isDark],
  );

  const baseXAxis = useCallback(
    (data: string[]) => ({
      type: "category" as const,
      data,
      axisLabel: { fontSize: 11, color: themeColors.textSecondary, margin: 12 },
      axisLine: { show: true, lineStyle: { color: "transparent", width: 1 } },
      axisTick: { show: false },
      boundaryGap: false,
    }),
    [themeColors.textSecondary],
  );
  const baseYAxis = useCallback(
    (name: string, formatter?: (val: number) => string) => ({
      type: "value" as const,
      name,
      nameTextStyle: { color: themeColors.textSecondary, padding: [0, 40, 0, 0] },
      axisLabel: {
        fontSize: 11,
        color: themeColors.textSecondary,
        ...(formatter ? { formatter: (val: number) => formatter(val) } : {}),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: themeColors.splitLine, type: "dashed" as const } },
    }),
    [themeColors.textSecondary, themeColors.splitLine],
  );

  const xAxisData = chartData.map((r) =>
    (selectedHours || 1) >= 24 ? dayjs(r.time).format("M/D HH:mm") : dayjs(r.time).format("HH:mm"),
  );

  const cpuChartOption = useMemo(
    () => ({
      animation: false,
      color: [CHART_COLORS.primary, CHART_COLORS.secondary],
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: isDark ? "rgba(40,40,40,0.95)" : "rgba(255,255,255,0.8)",
        borderWidth: 0,
        textStyle: { color: themeColors.text, fontSize: 12 },
      },
      grid: { top: 30, right: 24, bottom: 32, left: 56 },
      xAxis: baseXAxis(xAxisData),
      yAxis: [
        { ...baseYAxis("CPU %"), min: 0, max: 100, axisLabel: { fontSize: 11, color: themeColors.textSecondary, formatter: "{value}%" } },
        { ...baseYAxis("负载"), min: 0, splitLine: { show: false } },
      ],
      series: [
        {
          name: "CPU",
          type: "line",
          data: chartData.map((r) => r.cpu),
          showSymbol: false,
          yAxisIndex: 0,
          lineStyle: { width: 1.5, color: CHART_COLORS.primary },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(255,107,107,0.25)" },
                { offset: 1, color: "rgba(255,107,107,0.02)" },
              ],
            },
          },
        },
        {
          name: "负载",
          type: "line",
          data: chartData.map((r) => r.load),
          showSymbol: false,
          yAxisIndex: 1,
          lineStyle: { width: 1.5, color: CHART_COLORS.secondary },
        },
      ],
    }),
    [chartData, xAxisData, isDark, themeColors, baseXAxis, baseYAxis],
  );

  const memChartOption = useMemo(
    () => ({
      animation: false,
      color: [CHART_COLORS.primary, CHART_COLORS.secondary],
      tooltip: { trigger: "axis" as const, backgroundColor: isDark ? "rgba(40,40,40,0.95)" : "rgba(255,255,255,0.8)", borderWidth: 0, textStyle: { color: themeColors.text, fontSize: 12 } },
      grid: { top: 30, right: 24, bottom: 32, left: 56 },
      xAxis: baseXAxis(xAxisData),
      yAxis: { ...baseYAxis("内存", formatBytes), min: 0 },
      series: [
        { name: "RAM", type: "line", data: chartData.map((r) => r.ram), showSymbol: false, lineStyle: { width: 1.5, color: CHART_COLORS.primary }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(255,107,107,0.25)" }, { offset: 1, color: "rgba(255,107,107,0.02)" }] } } },
        { name: "Swap", type: "line", data: chartData.map((r) => r.swap), showSymbol: false, lineStyle: { width: 1.5, color: CHART_COLORS.secondary } },
      ],
    }),
    [chartData, xAxisData, isDark, themeColors, baseXAxis, baseYAxis],
  );

  const diskChartOption = useMemo(
    () => ({
      animation: false,
      color: [CHART_COLORS.primary],
      tooltip: { trigger: "axis" as const, backgroundColor: isDark ? "rgba(40,40,40,0.95)" : "rgba(255,255,255,0.8)", borderWidth: 0, textStyle: { color: themeColors.text, fontSize: 12 } },
      grid: { top: 30, right: 24, bottom: 32, left: 56 },
      xAxis: baseXAxis(xAxisData),
      yAxis: { ...baseYAxis("硬盘", formatBytes), min: 0 },
      series: [
        { name: "硬盘", type: "line", data: chartData.map((r) => r.disk), showSymbol: false, lineStyle: { width: 1.5, color: CHART_COLORS.primary }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(255,107,107,0.25)" }, { offset: 1, color: "rgba(255,107,107,0.02)" }] } } },
      ],
    }),
    [chartData, xAxisData, isDark, themeColors, baseXAxis, baseYAxis],
  );

  const netChartOption = useMemo(
    () => ({
      animation: false,
      color: [CHART_COLORS.tertiary, CHART_COLORS.quaternary],
      tooltip: { trigger: "axis" as const, backgroundColor: isDark ? "rgba(40,40,40,0.95)" : "rgba(255,255,255,0.8)", borderWidth: 0, textStyle: { color: themeColors.text, fontSize: 12 } },
      grid: { top: 30, right: 24, bottom: 32, left: 56 },
      xAxis: baseXAxis(xAxisData),
      yAxis: { ...baseYAxis("网络", formatBytes), min: 0 },
      series: [
        { name: "上行", type: "line", data: chartData.map((r) => r.net_out), showSymbol: false, lineStyle: { width: 1.5, color: CHART_COLORS.tertiary }, areaStyle: { color: "rgba(78,205,196,0.15)" } },
        { name: "下行", type: "line", data: chartData.map((r) => r.net_in), showSymbol: false, lineStyle: { width: 1.5, color: CHART_COLORS.quaternary }, areaStyle: { color: "rgba(167,139,250,0.15)" } },
      ],
    }),
    [chartData, xAxisData, isDark, themeColors, baseXAxis, baseYAxis],
  );

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">负载历史</CardTitle>
        <Tabs value={selectedView} onValueChange={setSelectedView}>
          <TabsList>
            {availableViews.map((v) => (
              <TabsTrigger key={v.label} value={v.label} className="text-xs">
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading && isInitial && data.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-destructive">{error}</div>
        ) : !chartData.length ? (
          <div className="flex h-64 items-center justify-center">
            <Empty description="暂无数据" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartBlock title="CPU / 负载" option={cpuChartOption} height="220px" />
            <ChartBlock title="内存" option={memChartOption} height="220px" />
            <ChartBlock title="硬盘" option={diskChartOption} height="220px" />
            <ChartBlock title="网络" option={netChartOption} height="220px" />
          </div>
        )}
        {latest && (
          <div className="mt-4 text-xs text-muted-foreground">
            最新上报: {dayjs(latest.time).format("YYYY-MM-DD HH:mm:ss")} · CPU{" "}
            {(latest.cpu ?? 0).toFixed(1)}% · RAM {formatBytesSplit(latest.ram ?? 0, appStore.byteDecimals).value}{" "}
            {formatBytesSplit(latest.ram ?? 0, appStore.byteDecimals).unit} · 在线 {nodeInfo?.online ? "是" : "否"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartBlock({ title, option, height }: { title: string; option: unknown; height: string }) {
  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">{title}</div>
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge lazyUpdate />
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

export default LoadChart;