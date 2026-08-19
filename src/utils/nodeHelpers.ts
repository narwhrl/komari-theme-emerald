import type { NodeData, TrafficLimitType } from '@/stores/nodes'

export function calculateTrafficUsed(upload: number, download: number, type: TrafficLimitType): number {
  switch (type) {
    case 'up': return upload
    case 'down': return download
    case 'min': return Math.min(upload, download)
    case 'max': return Math.max(upload, download)
    case 'sum':
    default: return upload + download
  }
}

export function getTrafficUsed(node: NodeData): number {
  return calculateTrafficUsed(
    node.net_total_up ?? 0,
    node.net_total_down ?? 0,
    node.traffic_limit_type,
  )
}

export function getTrafficUsedPercentage(node: NodeData): number {
  if (node.traffic_limit <= 0)
    return 0

  return Math.min((getTrafficUsed(node) / node.traffic_limit) * 100, 100)
}

export function hasTrafficLimit(node: NodeData): boolean {
  return node.traffic_limit > 0
}

export function getMemoryUsedPercentage(node: NodeData): number {
  return (node.ram ?? 0) / (node.mem_total || 1) * 100
}

export function getDiskUsedPercentage(node: NodeData): number {
  return (node.disk ?? 0) / (node.disk_total || 1) * 100
}

export function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}
