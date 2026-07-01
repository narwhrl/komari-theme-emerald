"use client";

import dynamic from "next/dynamic";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/EmptyCompat";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/stores/app";
import { cutPeakValues, interpolateNullsLinear } from "@/utils/recordHelper";
import { getSharedRpc } from "@/utils/rpc";
import "@/utils/echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface PingRecord {
  client: string;
  task_id: number;
  time: string;
  value: number;
}

interface TaskInfo {
  id: number;
  name: string;
  interval: number;
  loss: number;
  p99?: number;
  p50?: number;
  min?: number;
  max?: number;
  avg?: number;
  latest?: number;
  type?: string;
}

interface PingChartProps {
  uuid: string;
  className?: string;
}

const CHART_COLORS = [
  "#FF6B6B", "#4ECDC4", "#A78BFA", "#60A5FA",
  "#FFB347", "#F472B6", "#34D399", "#FB923C",
];

const PRESET_VIEWS = [
  { label: "1 小时", hours: 1 },
  { label: "6 小时", hours: 6 },
  { label: "12 小时", hours: 12 },
  { label: "1 天", hours: 24 },
];

export function PingChart({ uuid, className }: PingChartProps) {
  const appStore = useAppStore();
  const maxHours = appStore.publicSettings?.ping_record_preserve_time || 168;
  const isDark = useThemeDarkProxy();

  const availableViews = useMemo(() => {
    const views: { label: string; hours: number }[] = [];
    for (const v of PRESET_VIEWS) if (maxHours >= v.hours) views.push(v);
    if (maxHours > 24) {
      const label = maxHours % 24 === 0 ? `${maxHours / 24} 天` : `${maxHours} 小时`;
      views.push({ label, hours: maxHours });
    } else if (maxHours > 1 && !PRESET_VIEWS.some((v) => v.hours === maxHours)) {
      const label = maxHours % 24 === 0 ? `${maxHours / 24} 天` : `${maxHours} 小时`;
      views.push({ label, hours: maxHours });
    }
    return views;
  }, [maxHours]);

  const [selectedView, setSelectedView] = useState<string>("");
  const [records, setRecords] = useState<PingRecord[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelay, setShowDelay] = useState(true);
  const [showLoss, setShowLoss] = useState(true);
  const [cutPeak, setCutPeak] = useState(false);

  const selectedHours = useMemo(() => {
    const view = availableViews.find((v) => v.label === selectedView);
    return view?.hours || 1;
  }, [selectedView, availableViews]);

  // Set default view
  useEffect(() => {
    if (!selectedView && availableViews[0]) setSelectedView(availableViews[0].label);
  }, [availableViews, selectedView]);

  // Fetch records
  useEffect(() => {
    if (!uuid || !selectedView) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rpc = getSharedRpc();
        const result = await rpc.getClient().call<{
          records?: PingRecord[];
          tasks?: TaskInfo[];
        }>("common:getRecords", { uuid, type: "ping", hours: selectedHours });
        if (cancelled) return;
        const recs = (result?.records || []).sort(
          (a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf(),
        );
        setRecords(recs);
        const newTasks = result?.tasks || [];
        setTasks(newTasks);
        if (newTasks.length > 0 && selectedTaskIds.length === 0) {
          setSelectedTaskIds(newTasks.map((t) => t.id));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "获取数据失败");
          setRecords([]);
          setTasks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, selectedHours, selectedView]);

  // Group records by task_id, build time series
  const chartData = useMemo(() => {
    if (!records.length) return [];
    const grouped = new Map<number, PingRecord[]>();
    for (const r of records) {
      if (!selectedTaskIds.includes(r.task_id)) continue;
      const list = grouped.get(r.task_id) ?? [];
      list.push(r);
      grouped.set(r.task_id, list);
    }
    const allTimes = new Set<number>();
    for (const list of grouped.values()) {
      for (const r of list) allTimes.add(dayjs(r.time).valueOf());
    }
    const times = [...allTimes].sort((a, b) => a - b);
    const map: Record<string, number | null> = {};
    for (const t of times) map[t] = null;

    const data: Record<string, Record<string, number | null>> = {};
    for (const [taskId, list] of grouped) {
      const task = tasks.find((t) => t.id === taskId);
      const key = String(taskId);
      data[key] = { ...map };
      for (const r of list) {
        const k = String(dayjs(r.time).valueOf());
        // value < 0 means loss
        data[key][k] = r.value >= 0 ? r.value : null;
      }
    }
    const lossData: Record<string, Record<string, number | null>> = {};
    for (const [taskId, list] of grouped) {
      const key = String(taskId);
      const buckets = new Map<string, { total: number; lost: number }>();
      for (const r of list) {
        const tBucket = dayjs(r.time).startOf("minute").valueOf();
        const k = String(tBucket);
        const b = buckets.get(k) ?? { total: 0, lost: 0 };
        b.total += 1;
        if (r.value < 0) b.lost += 1;
        buckets.set(k, b);
      }
      const obj: Record<string, number | null> = {};
      for (const [k, b] of buckets) {
        obj[k] = b.total > 0 ? (b.lost / b.total) * 100 : 0;
      }
      lossData[key] = obj;
    }

    // Convert to arrays sorted by time
    const sortedKeys = [...allTimes].sort((a, b) => a - b).map(String);
    const result: {
      time: number;
      timeLabel: string;
      latency: Record<string, number | null>;
      loss: Record<string, number | null>;
    }[] = sortedKeys.map((k) => ({
      time: Number(k),
      timeLabel: dayjs(Number(k)).format("HH:mm"),
      latency: Object.fromEntries(Object.entries(data).map(([tid, o]) => [tid, o[k] ?? null])),
      loss: Object.fromEntries(Object.entries(lossData).map(([tid, o]) => [tid, o[k] ?? null])),
    }));

    if (cutPeak) {
      return result.map((row) => ({
        ...row,
        latency: Object.fromEntries(
          Object.entries(row.latency).map(([k, v]) => [k, v !== null && v > 5000 ? null : v]),
        ),
      }));
    }
    return result;
  }, [records, tasks, selectedTaskIds, cutPeak]);

  const themeColors = useMemo(
    () => ({
      text: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)",
      textSecondary: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
      splitLine: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
      tooltipBg: isDark ? "rgba(40,40,40,0.95)" : "rgba(255,255,255,0.8)",
    }),
    [isDark],
  );

  const xAxisData = chartData.map((r) => r.timeLabel);

  const latencyChartOption = useMemo(() => {
    const taskList = tasks.filter((t) => selectedTaskIds.includes(t.id));
    return {
      animation: false,
      color: CHART_COLORS,
      tooltip: { trigger: "axis" as const, backgroundColor: themeColors.tooltipBg, borderWidth: 0, textStyle: { color: themeColors.text, fontSize: 12 } },
      legend: { textStyle: { color: themeColors.textSecondary, fontSize: 11 }, top: 0, type: "scroll" },
      grid: { top: 40, right: 24, bottom: 32, left: 56 },
      xAxis: {
        type: "category" as const,
        data: xAxisData,
        axisLabel: { fontSize: 11, color: themeColors.textSecondary },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        name: "延迟 (ms)",
        nameTextStyle: { color: themeColors.textSecondary, padding: [0, 40, 0, 0] },
        axisLabel: { fontSize: 11, color: themeColors.textSecondary, formatter: "{value} ms" },
        splitLine: { lineStyle: { color: themeColors.splitLine, type: "dashed" as const } },
      },
      series: taskList.map((task, idx) => ({
        name: task.name,
        type: "line",
        data: chartData.map((r) => r.latency[String(task.id)]),
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1.5, color: CHART_COLORS[idx % CHART_COLORS.length] },
        connectNulls: false,
      })),
    };
  }, [chartData, tasks, selectedTaskIds, xAxisData, themeColors]);

  const lossChartOption = useMemo(() => {
    const taskList = tasks.filter((t) => selectedTaskIds.includes(t.id));
    return {
      animation: false,
      color: CHART_COLORS,
      tooltip: { trigger: "axis" as const, backgroundColor: themeColors.tooltipBg, borderWidth: 0, textStyle: { color: themeColors.text, fontSize: 12 }, valueFormatter: (val: number) => `${val.toFixed(2)}%` },
      legend: { textStyle: { color: themeColors.textSecondary, fontSize: 11 }, top: 0, type: "scroll" },
      grid: { top: 40, right: 24, bottom: 32, left: 56 },
      xAxis: {
        type: "category" as const,
        data: xAxisData,
        axisLabel: { fontSize: 11, color: themeColors.textSecondary },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        name: "丢包 (%)",
        max: 100,
        nameTextStyle: { color: themeColors.textSecondary, padding: [0, 40, 0, 0] },
        axisLabel: { fontSize: 11, color: themeColors.textSecondary, formatter: "{value}%" },
        splitLine: { lineStyle: { color: themeColors.splitLine, type: "dashed" as const } },
      },
      series: taskList.map((task, idx) => ({
        name: task.name,
        type: "line",
        data: chartData.map((r) => r.loss[String(task.id)]),
        showSymbol: false,
        lineStyle: { width: 1.5, color: CHART_COLORS[idx % CHART_COLORS.length] },
        areaStyle: { opacity: 0.1 },
      })),
    };
  }, [chartData, tasks, selectedTaskIds, xAxisData, themeColors]);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
        <CardTitle className="text-base">Ping 历史</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={selectedView} onValueChange={setSelectedView}>
            <TabsList>
              {availableViews.map((v) => (
                <TabsTrigger key={v.label} value={v.label} className="text-xs">{v.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <button
            type="button"
            onClick={() => setShowDelay((v) => !v)}
            className={`text-xs px-2 py-0.5 rounded border ${showDelay ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}
          >
            延迟
          </button>
          <button
            type="button"
            onClick={() => setShowLoss((v) => !v)}
            className={`text-xs px-2 py-0.5 rounded border ${showLoss ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}
          >
            丢包
          </button>
          <button
            type="button"
            onClick={() => setCutPeak((v) => !v)}
            className={`text-xs px-2 py-0.5 rounded border ${cutPeak ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}
          >
            去峰值
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Spinner /></div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-destructive">{error}</div>
        ) : !chartData.length ? (
          <div className="flex h-64 items-center justify-center">
            <Empty description="暂无数据" />
          </div>
        ) : (
          <div className="space-y-4">
            {showDelay && <ReactECharts option={latencyChartOption} style={{ height: 240, width: "100%" }} notMerge lazyUpdate />}
            {showLoss && <ReactECharts option={lossChartOption} style={{ height: 200, width: "100%" }} notMerge lazyUpdate />}
            {tasks.length > 1 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {tasks.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskIds((cur) =>
                        cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id],
                      );
                    }}
                    className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${
                      selectedTaskIds.includes(t.id) ? "bg-primary/10 border-primary/30" : "border-border text-muted-foreground"
                    }`}
                  >
                    <span className="size-2 rounded-full" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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

export default PingChart;