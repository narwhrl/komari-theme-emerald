"use client";

/**
 * useNodePingStats — React port of the Vue composable that aggregates ping
 * records for a node over a time window. Uses TanStack Query for fetching
 * and a module-level cache so multiple consumers share one network request.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useThrottle } from "@/hooks/useThrottle";
import { getSharedRpc } from "@/utils/rpc";

export const NODE_PING_BAR_COUNT = 20;
const CACHE_VERSION = 5;
const CACHE_KEY_PREFIX = "komari-theme-emerald:node-ping-stats";
const FULL_LOSS_EPSILON = 1e-6;
const PING_RECORD_REFRESH_INTERVAL_MS = 60_000;

export interface NodePingHistoryPoint {
  time: string;
  latency: number | null;
  loss: number | null;
}

export interface NodePingStatsState {
  avgLatency: number;
  avgLoss: number;
  avgVolatility: number;
  history: NodePingHistoryPoint[];
  hasData: boolean;
}

interface PingRecord {
  client: string;
  task_id: number;
  time: string;
  value: number;
}

interface SharedPingRecordsResponse {
  records?: PingRecord[];
}

function createEmptyStats(): NodePingStatsState {
  return { avgLatency: 0, avgLoss: 0, avgVolatility: 0, history: [], hasData: false };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function summarizeTaskRecords(records: PingRecord[]): Map<number, { total: number; success: number }> {
  const summaries = new Map<number, { total: number; success: number }>();
  for (const record of records) {
    const s = summaries.get(record.task_id) ?? { total: 0, success: 0 };
    s.total += 1;
    if (record.value >= 0) s.success += 1;
    summaries.set(record.task_id, s);
  }
  return summaries;
}

function getIncludedTaskIds(records: PingRecord[]): Set<number> {
  const summaries = summarizeTaskRecords(records);
  return new Set(
    [...summaries.entries()]
      .filter(([, s]) => s.total > 0 && s.success > 0)
      .map(([taskId]) => taskId),
  );
}

function getCacheKey(uuid: string, hours: number): string {
  return `${CACHE_KEY_PREFIX}:${uuid}:${hours}`;
}

function isValidHistoryPoint(value: unknown): value is NodePingHistoryPoint {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const l = p.latency;
  const lo = p.loss;
  return (
    typeof p.time === "string" &&
    (l === null || typeof l === "number") &&
    (lo === null || typeof lo === "number")
  );
}

function isValidStatsState(value: unknown): value is NodePingStatsState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.avgLatency === "number" &&
    typeof s.avgLoss === "number" &&
    typeof s.avgVolatility === "number" &&
    typeof s.hasData === "boolean" &&
    Array.isArray(s.history) &&
    s.history.every(isValidHistoryPoint)
  );
}

function readStatsCache(uuid: string, hours: number): NodePingStatsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getCacheKey(uuid, hours));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; stats?: unknown };
    if (parsed.version !== CACHE_VERSION || !isValidStatsState(parsed.stats)) return null;
    return parsed.stats;
  } catch {
    return null;
  }
}

function writeStatsCache(uuid: string, hours: number, value: NodePingStatsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getCacheKey(uuid, hours),
      JSON.stringify({ version: CACHE_VERSION, updatedAt: new Date().toISOString(), stats: value }),
    );
  } catch {
    /* ignore */
  }
}

function buildRecordsByClient(records: PingRecord[]): Map<string, PingRecord[]> {
  const grouped = new Map<string, PingRecord[]>();
  for (const record of records) {
    if (!record.client) continue;
    const list = grouped.get(record.client) ?? [];
    list.push(record);
    grouped.set(record.client, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }
  return grouped;
}

function buildPingHistory(records: PingRecord[]): NodePingHistoryPoint[] {
  const sorted = records
    .map((r) => ({ ...r, timestamp: new Date(r.time).getTime() }))
    .filter((r) => Number.isFinite(r.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!sorted.length) return [];
  const firstTime = sorted[0]?.timestamp ?? 0;
  const lastTime = sorted.at(-1)?.timestamp ?? firstTime;
  const bucketCount = Math.min(NODE_PING_BAR_COUNT, sorted.length);
  const bucketSize = Math.max(1, (lastTime - firstTime) / bucketCount);

  return Array.from({ length: bucketCount }, (_, index) => {
    const startTime = firstTime + bucketSize * index;
    const endTime = index === bucketCount - 1 ? lastTime + 1 : startTime + bucketSize;
    const bucketRecords = sorted.filter((r) => r.timestamp >= startTime && r.timestamp < endTime);
    const valid = bucketRecords.filter((r) => r.value >= 0);
    const lost = bucketRecords.length - valid.length;
    const latency = valid.length ? average(valid.map((r) => r.value)) : null;
    const loss = bucketRecords.length ? (lost / bucketRecords.length) * 100 : null;
    return { time: new Date(startTime).toISOString(), latency, loss };
  });
}

function getPercentile(values: number[], percentile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * percentile));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lo = sorted[lower];
  const up = sorted[upper];
  if (lo === undefined || up === undefined) return null;
  if (lower === upper) return lo;
  return lo + (up - lo) * (position - lower);
}

function buildStats(records: PingRecord[]): NodePingStatsState {
  const includedTaskIds = getIncludedTaskIds(records);
  if (!includedTaskIds.size) return createEmptyStats();
  const filtered = records.filter((r) => includedTaskIds.has(r.task_id));
  const history = buildPingHistory(filtered);
  const taskRecords = new Map<number, PingRecord[]>();
  for (const r of filtered) {
    const list = taskRecords.get(r.task_id) ?? [];
    list.push(r);
    taskRecords.set(r.task_id, list);
  }
  const latencyValues: number[] = [];
  const taskLossValues: number[] = [];
  const volatilityValues: number[] = [];
  for (const list of taskRecords.values()) {
    const valid = list.map((r) => r.value).filter((v) => v >= 0);
    if (!valid.length) continue;
    latencyValues.push(average(valid));
    taskLossValues.push(((list.length - valid.length) / list.length) * 100);
    if (valid.length > 1) {
      const p50 = getPercentile(valid, 0.5);
      const p99 = getPercentile(valid, 0.99);
      if (isFiniteNumber(p50) && isFiniteNumber(p99) && p50 > FULL_LOSS_EPSILON) {
        volatilityValues.push(p99 / p50);
      }
    }
  }
  const avgLatency = latencyValues.length
    ? average(latencyValues)
    : average(history.map((p) => p.latency).filter(isFiniteNumber));
  const avgLoss = taskLossValues.length
    ? average(taskLossValues)
    : average(history.map((p) => p.loss).filter(isFiniteNumber));
  const avgVolatility = average(volatilityValues);
  const hasData = history.length > 0 || latencyValues.length > 0 || taskLossValues.length > 0;
  return { avgLatency, avgLoss, avgVolatility, history, hasData };
}

// Shared cache across components
const sharedRecordsCache = new Map<number, { recordsByClient: Map<string, PingRecord[]>; lastFetchedAt: number }>();

async function fetchSharedPingRecords(hours: number): Promise<{ recordsByClient: Map<string, PingRecord[]> }> {
  const rpc = getSharedRpc();
  const result = await rpc.getClient().call<SharedPingRecordsResponse>("common:getRecords", {
    type: "ping",
    hours,
  });
  return { recordsByClient: buildRecordsByClient(result?.records ?? []) };
}

export function useNodePingStats(
  uuid: string,
  options?: {
    hours?: number;
    enabled?: boolean;
  },
) {
  const hours = Math.max(1, Math.floor(options?.hours ?? 24));
  const enabled = options?.enabled ?? true;

  const query = useQuery({
    queryKey: ["ping-records", hours],
    queryFn: async () => {
      const data = await fetchSharedPingRecords(hours);
      sharedRecordsCache.set(hours, { ...data, lastFetchedAt: Date.now() });
      return data;
    },
    enabled,
    refetchInterval: PING_RECORD_REFRESH_INTERVAL_MS,
    staleTime: PING_RECORD_REFRESH_INTERVAL_MS / 2,
  });

  const [stats, setStats] = useState<NodePingStatsState>(
    () => readStatsCache(uuid, hours) ?? createEmptyStats(),
  );

  useEffect(() => {
    if (!enabled || !uuid.trim()) {
      setStats(createEmptyStats());
      return;
    }
    const cached = sharedRecordsCache.get(hours);
    const recordsByClient = cached?.recordsByClient ?? query.data?.recordsByClient;
    if (!recordsByClient) return;
    const records = recordsByClient.get(uuid) ?? [];
    const next = records.length ? buildStats(records) : readStatsCache(uuid, hours) ?? createEmptyStats();
    setStats(next);
  }, [uuid, hours, enabled, query.data]);

  const persist = useThrottle(
    (value: NodePingStatsState) => {
      if (value.hasData) writeStatsCache(uuid, hours, value);
    },
    PING_RECORD_REFRESH_INTERVAL_MS,
  );

  useEffect(() => {
    persist(stats);
  }, [stats, persist]);

  return {
    stats,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    history: stats.history,
    avgLatency: stats.avgLatency,
    avgLoss: stats.avgLoss,
    avgVolatility: stats.avgVolatility,
    hasData: stats.hasData,
  };
}

// Re-export for backward compatibility with old composable callers
export function useNodePingStatsByRef(uuid: string | (() => string), hoursRef: number | (() => number) | undefined, enabledRef?: boolean | (() => boolean)) {
  const uuidValue = typeof uuid === "function" ? uuid() : uuid;
  const hoursValue = typeof hoursRef === "function" ? hoursRef() : hoursRef;
  const enabledValue = typeof enabledRef === "function" ? enabledRef() : enabledRef;
  return useNodePingStats(uuidValue, { hours: hoursValue, enabled: enabledValue });
}