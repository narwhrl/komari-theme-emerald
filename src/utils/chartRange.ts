const LOAD_RANGE_FALLBACK_HOURS = 720
const PING_RANGE_FALLBACK_HOURS = 168
const LOAD_RANGE_PRESETS: readonly number[] = [4, 24, 168, 720]
const PING_RANGE_PRESETS = [1, 6, 12, 24] as const

export type LoadRangeSelection = number | null

function isValidPreserveLimit(limit: unknown): limit is number {
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0
}

export function sanitizeLoadPreserveHours(limit: unknown): number {
  return isValidPreserveLimit(limit) ? limit : LOAD_RANGE_FALLBACK_HOURS
}

export function sanitizePingPreserveHours(limit: unknown): number {
  if (!isValidPreserveLimit(limit))
    return PING_RANGE_FALLBACK_HOURS
  return limit < 1 ? 1 : limit
}

export function getLoadRangeCandidates(limit: unknown): readonly [null, ...number[]] {
  const maxHours = sanitizeLoadPreserveHours(limit)
  const candidates: [null, ...number[]] = [null]

  for (const hours of LOAD_RANGE_PRESETS) {
    if (maxHours >= hours)
      candidates.push(hours)
  }

  const maxPreset = LOAD_RANGE_PRESETS.at(-1)
  if (maxPreset && maxHours > maxPreset)
    candidates.push(maxHours)
  else if (maxHours > 4 && !LOAD_RANGE_PRESETS.includes(maxHours))
    candidates.push(maxHours)

  return candidates
}

export function getPingRangeCandidates(limit: unknown): readonly [number, ...number[]] {
  const maxHours = sanitizePingPreserveHours(limit)
  const candidates = PING_RANGE_PRESETS.filter(hours => maxHours >= hours)
  return (candidates.length > 0 ? candidates : [1]) as [number, ...number[]]
}

export function getEffectiveRangeSelection<T>(
  candidates: readonly T[],
  selected: T,
): T {
  const fallback = candidates[0]
  if (fallback === undefined)
    return selected
  return candidates.some(candidate => Object.is(candidate, selected))
    ? selected
    : fallback
}

export function getLoadRangeTabValue(hours: LoadRangeSelection): string {
  return hours === null ? 'realtime' : `hours:${hours}`
}

export function parseLoadRangeTabValue(value: string): LoadRangeSelection | undefined {
  if (value === 'realtime')
    return null
  if (!value.startsWith('hours:'))
    return undefined
  const hours = Number(value.slice('hours:'.length))
  return Number.isFinite(hours) ? hours : undefined
}

export function getPingRangeTabValue(hours: number): string {
  return `hours:${hours}`
}
