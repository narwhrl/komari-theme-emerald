import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'
import { getSharedRpc } from '@/utils/rpc'

export interface NodePingHistoryPoint {
  time: string
  latency: number | null
  loss: number | null
}

export interface NodePingStatsState {
  avgLatency: number
  avgLoss: number
  avgVolatility: number
  history: NodePingHistoryPoint[]
  hasData: boolean
}

interface PingRecord {
  task_id: number
  time: string
  value: number
}

interface PingTaskInfo {
  id: number
  loss?: number
  avg?: number
  latest?: number
  p50?: number
  p99_p50_ratio?: number
}

interface PingRecordsResponse {
  records?: PingRecord[]
  tasks?: PingTaskInfo[]
}

const HISTORY_BUCKET_COUNT = 20
const CACHE_VERSION = 2
const CACHE_KEY_PREFIX = 'komari-theme-emerald:node-ping-stats'
const FULL_LOSS_EPSILON = 1e-6

interface TaskRecordSummary {
  total: number
  success: number
}

function createEmptyStats(): NodePingStatsState {
  return {
    avgLatency: 0,
    avgLoss: 0,
    avgVolatility: 0,
    history: [],
    hasData: false,
  }
}

function average(values: number[]): number {
  if (!values.length)
    return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function summarizeTaskRecords(records: PingRecord[]): Map<number, TaskRecordSummary> {
  const summaries = new Map<number, TaskRecordSummary>()

  for (const record of records) {
    const summary = summaries.get(record.task_id) ?? { total: 0, success: 0 }
    summary.total += 1
    if (record.value >= 0) {
      summary.success += 1
    }
    summaries.set(record.task_id, summary)
  }

  return summaries
}

function isTaskFullyLost(task: PingTaskInfo | undefined, summary: TaskRecordSummary | undefined): boolean {
  if (isFiniteNumber(task?.loss) && task.loss >= 100 - FULL_LOSS_EPSILON)
    return true

  return Boolean(summary && summary.total > 0 && summary.success === 0)
}

function getIncludedTaskIds(records: PingRecord[], tasks: PingTaskInfo[]): Set<number> {
  const recordSummaries = summarizeTaskRecords(records)
  const tasksById = new Map(tasks.map(task => [task.id, task]))
  const taskIds = new Set<number>([
    ...recordSummaries.keys(),
    ...tasksById.keys(),
  ])

  return new Set(
    [...taskIds].filter((taskId) => {
      const task = tasksById.get(taskId)
      const summary = recordSummaries.get(taskId)
      return !isTaskFullyLost(task, summary)
    }),
  )
}

function getCacheKey(uuid: string, hours: number): string {
  return `${CACHE_KEY_PREFIX}:${uuid}:${hours}`
}

function isValidHistoryPoint(value: unknown): value is NodePingHistoryPoint {
  if (!value || typeof value !== 'object')
    return false

  const point = value as Record<string, unknown>
  const latency = point.latency
  const loss = point.loss

  return typeof point.time === 'string'
    && (latency === null || typeof latency === 'number')
    && (loss === null || typeof loss === 'number')
}

function isValidStatsState(value: unknown): value is NodePingStatsState {
  if (!value || typeof value !== 'object')
    return false

  const state = value as Record<string, unknown>
  return typeof state.avgLatency === 'number'
    && typeof state.avgLoss === 'number'
    && typeof state.avgVolatility === 'number'
    && typeof state.hasData === 'boolean'
    && Array.isArray(state.history)
    && state.history.every(isValidHistoryPoint)
}

function readStatsCache(uuid: string, hours: number): NodePingStatsState | null {
  if (typeof window === 'undefined')
    return null

  try {
    const raw = window.localStorage.getItem(getCacheKey(uuid, hours))
    if (!raw)
      return null

    const parsed = JSON.parse(raw) as { version?: number, stats?: unknown }
    if (parsed.version !== CACHE_VERSION || !isValidStatsState(parsed.stats))
      return null

    return parsed.stats
  }
  catch {
    return null
  }
}

function writeStatsCache(uuid: string, hours: number, value: NodePingStatsState): void {
  if (typeof window === 'undefined')
    return

  try {
    window.localStorage.setItem(
      getCacheKey(uuid, hours),
      JSON.stringify({
        version: CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        stats: value,
      }),
    )
  }
  catch {
  }
}

function buildPingHistory(records: PingRecord[]): NodePingHistoryPoint[] {
  const sortedRecords = records
    .map((record) => {
      const timestamp = new Date(record.time).getTime()
      return { ...record, timestamp }
    })
    .filter(record => Number.isFinite(record.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)

  if (!sortedRecords.length)
    return []

  const firstTime = sortedRecords[0]?.timestamp ?? 0
  const lastTime = sortedRecords.at(-1)?.timestamp ?? firstTime
  const bucketCount = Math.min(HISTORY_BUCKET_COUNT, sortedRecords.length)
  const bucketSize = Math.max(1, (lastTime - firstTime) / bucketCount)

  return Array.from({ length: bucketCount }, (_, index) => {
    const startTime = firstTime + bucketSize * index
    const endTime = index === bucketCount - 1 ? lastTime + 1 : startTime + bucketSize
    const bucketRecords = sortedRecords.filter(
      record => record.timestamp >= startTime && record.timestamp < endTime,
    )
    const validLatencyRecords = bucketRecords.filter(record => record.value >= 0)
    const lostCount = bucketRecords.length - validLatencyRecords.length
    const latency = validLatencyRecords.length
      ? average(validLatencyRecords.map(record => record.value))
      : null
    const loss = bucketRecords.length
      ? lostCount / bucketRecords.length * 100
      : null

    return {
      time: new Date(startTime).toISOString(),
      latency,
      loss,
    }
  })
}

function buildStats(result?: PingRecordsResponse): NodePingStatsState {
  const rawRecords = result?.records ?? []
  const rawTasks = result?.tasks ?? []
  const includedTaskIds = getIncludedTaskIds(rawRecords, rawTasks)

  if (!includedTaskIds.size)
    return createEmptyStats()

  const records = rawRecords.filter(record => includedTaskIds.has(record.task_id))
  const tasks = rawTasks.filter(task => includedTaskIds.has(task.id))
  const history = buildPingHistory(records)

  const latencyValues = tasks
    .map(task => task.avg ?? task.latest ?? task.p50)
    .filter(isFiniteNumber)
  const historyLatencyValues = history
    .map(point => point.latency)
    .filter(isFiniteNumber)

  const taskLossValues = tasks
    .map(task => task.loss)
    .filter(isFiniteNumber)
  const historyLossValues = history
    .map(point => point.loss)
    .filter(isFiniteNumber)

  const volatilityValues = tasks
    .map(task => task.p99_p50_ratio)
    .filter((value): value is number => isFiniteNumber(value) && value > 0)

  const avgLatency = latencyValues.length ? average(latencyValues) : average(historyLatencyValues)
  const avgLoss = taskLossValues.length ? average(taskLossValues) : average(historyLossValues)
  const avgVolatility = average(volatilityValues)
  const hasData = history.length > 0 || latencyValues.length > 0 || taskLossValues.length > 0

  return {
    avgLatency,
    avgLoss,
    avgVolatility,
    history,
    hasData,
  }
}

export function useNodePingStats(
  uuid: MaybeRefOrGetter<string>,
  options?: {
    hours?: MaybeRefOrGetter<number>
    enabled?: MaybeRefOrGetter<boolean>
  },
) {
  const rpc = getSharedRpc()
  const stats = ref<NodePingStatsState>(createEmptyStats())
  const loading = ref(false)
  const error = ref<string | null>(null)

  watch(
    [
      () => toValue(uuid),
      () => Math.max(1, Math.floor(toValue(options?.hours) ?? 24)),
      () => toValue(options?.enabled) ?? true,
    ],
    async ([nextUuid, nextHours, enabled], _previous, onCleanup) => {
      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })

      if (!enabled || !nextUuid.trim()) {
        loading.value = false
        error.value = null
        stats.value = createEmptyStats()
        return
      }

      const cachedStats = readStatsCache(nextUuid, nextHours)
      if (cachedStats) {
        stats.value = cachedStats
      }
      else {
        stats.value = createEmptyStats()
      }

      loading.value = true
      error.value = null

      try {
        const result = await rpc.getClient().call<PingRecordsResponse>('common:getRecords', {
          uuid: nextUuid,
          type: 'ping',
          hours: nextHours,
        })

        if (cancelled)
          return

        const nextStats = buildStats(result)
        stats.value = nextStats
        writeStatsCache(nextUuid, nextHours, nextStats)
      }
      catch (err) {
        if (cancelled)
          return

        error.value = err instanceof Error ? err.message : '获取 Ping 历史失败'
        if (!cachedStats) {
          stats.value = createEmptyStats()
        }
      }
      finally {
        if (!cancelled) {
          loading.value = false
        }
      }
    },
    { immediate: true },
  )

  return {
    stats,
    loading,
    error,
    history: computed(() => stats.value.history),
    avgLatency: computed(() => stats.value.avgLatency),
    avgLoss: computed(() => stats.value.avgLoss),
    avgVolatility: computed(() => stats.value.avgVolatility),
    hasData: computed(() => stats.value.hasData),
  }
}
