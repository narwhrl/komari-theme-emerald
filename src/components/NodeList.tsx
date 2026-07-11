'use client'

import type { KeyboardEvent } from 'react'
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/react'
import { useMemo, useState } from 'react'
import NodePingListCell from '@/components/NodePingListCell'
import TrafficProgress from '@/components/TrafficProgress'
import { Badge } from '@/components/ui/badge'
import { ProgressThin } from '@/components/ui/progress-thin'
import { DataTooltip } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { getExpireTextClass, getNodePriceTags, parseTags } from '@/utils/tagHelper'

interface ColumnConfig {
  key: string
  label: string
  width: string | number
  sortable: boolean
}

const columns: ColumnConfig[] = [
  { key: 'status', label: '状态', width: '40px', sortable: false },
  { key: 'os', label: '系统', width: '40px', sortable: false },
  { key: 'name', label: '节点', width: 'minmax(160px, 0.8fr)', sortable: true },
  { key: 'tags', label: '标签', width: 'minmax(200px, 1fr)', sortable: false },
  { key: 'uptime', label: '运行时间', width: '116px', sortable: true },
  { key: 'cpu', label: 'CPU', width: '100px', sortable: false },
  { key: 'mem', label: '内存', width: '100px', sortable: false },
  { key: 'disk', label: '硬盘', width: '100px', sortable: false },
  { key: 'traffic', label: '流量', width: '100px', sortable: false },
  { key: 'rate', label: '速率', width: '80px', sortable: true },
]

function getTrafficUsed(node: NodeData): number {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  switch (traffic_limit_type) {
    case 'up': return net_total_up
    case 'down': return net_total_down
    case 'min': return Math.min(net_total_up, net_total_down)
    case 'max': return Math.max(net_total_up, net_total_down)
    case 'sum':
    default: return net_total_up + net_total_down
  }
}

function getTrafficUsedPercentage(node: NodeData): number {
  if (node.traffic_limit <= 0)
    return 0
  return Math.min((getTrafficUsed(node) / node.traffic_limit) * 100, 100)
}

export default function NodeList({
  nodes,
  transitionKey,
  onClick,
  onPingClick,
}: {
  nodes: NodeData[]
  transitionKey?: string
  onClick: (node: NodeData) => void
  onPingClick: (node: NodeData) => void
}) {
  const [sortKey, setSortKey] = useState('')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const byteDecimals = useAppStore(state => state.byteDecimals)
  const lang = useAppStore(state => state.lang)
  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, byteDecimals)
  const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, byteDecimals)
  const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'hour')
  const gridTemplateColumns = columns.map(col => col.width).join(' ')
  const columnKeys = columns.map(col => col.key)
  const nameIndex = columnKeys.indexOf('name')
  const offlineOverlayContentStyle = { gridColumn: `${nameIndex + 1} / -1` }

  const sortedNodes = useMemo(() => {
    const sorted = [...nodes]
    if (!sortKey)
      return sorted

    return sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name': {
          const va = (a.name || '').toLowerCase()
          const vb = (b.name || '').toLowerCase()
          return sortDir * (va < vb ? -1 : va > vb ? 1 : 0)
        }
        case 'uptime': return sortDir * ((a.uptime ?? 0) - (b.uptime ?? 0))
        case 'rate': return sortDir * (((a.net_out ?? 0) + (a.net_in ?? 0)) - ((b.net_out ?? 0) + (b.net_in ?? 0)))
        default: return 0
      }
    })
  }, [nodes, sortDir, sortKey])

  function handleSort(col: ColumnConfig) {
    if (!col.sortable)
      return
    if (sortKey === col.key) {
      setSortDir(value => value === 1 ? -1 : 1)
    }
    else {
      setSortKey(col.key)
      setSortDir(1)
    }
  }

  function handleNodeKeyDown(event: KeyboardEvent<HTMLDivElement>, node: NodeData) {
    if (event.key !== 'Enter' && event.key !== ' ')
      return
    event.preventDefault()
    onClick(node)
  }

  return (
    <div className="min-w-0 overflow-x-auto overflow-y-hidden p-1 -m-1">
      <div className="flex w-full min-w-fit flex-col gap-1">
        <div className="grid gap-2 rounded-2xl border border-input bg-muted/72 p-2 shadow-xs/5" style={{ gridTemplateColumns }}>
          {columns.map(col => (
            <button
              type="button"
              key={col.key}
              className={`${col.sortable ? 'cursor-pointer' : 'cursor-default'} ${['status', 'os'].includes(col.key) ? 'text-center' : 'text-left'}`}
              onClick={() => handleSort(col)}
            >
              <span className="text-xs text-muted-foreground">
                {col.label}
                {col.sortable && sortKey === col.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {sortedNodes.map((node, index) => (
            <div
              key={transitionKey ? `${transitionKey}-${node.uuid}` : node.uuid}
              role="button"
              tabIndex={0}
              aria-label={`查看节点 ${node.name} 详情`}
              className={`motion-card motion-card-pressable motion-stagger-item relative flex h-16 cursor-pointer flex-col justify-center rounded-xl border border-input bg-card px-2 shadow-xs/5 ${!node.online ? '!border-destructive/25' : ''}`}
              style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              onClick={() => onClick(node)}
              onKeyDown={event => handleNodeKeyDown(event, node)}
            >
              <div className="grid items-center gap-2" style={{ gridTemplateColumns }}>
                {columns.map(col => renderCell(col.key, node))}
              </div>
              {!node.online
                ? (
                    <div className="absolute inset-0 z-2 flex items-center rounded-xl bg-background/10 p-2" aria-hidden="true">
                      <div className="grid items-center justify-center gap-2" style={{ gridTemplateColumns }}>
                        <div className="h-full space-y-1" style={offlineOverlayContentStyle}>
                          <div className="truncate text-sm font-semibold">
                            <span className="text-red-500">离线</span>
                            {' '}
                            {node.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(node.time)}</div>
                        </div>
                      </div>
                    </div>
                  )
                : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  function renderCell(key: string, node: NodeData) {
    const mutedClass = !node.online ? 'blur-sm opacity-30' : ''

    switch (key) {
      case 'status':
        return (
          <div key={key} className="flex justify-center">
            <div className={`status-pulse relative size-2 rounded-full ${node.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
              <span className="block size-full rounded-full bg-current" />
            </div>
          </div>
        )
      case 'os':
        return <div key={key} className="flex justify-center"><img src={getOSImage(node.os)} alt={getOSName(node.os)} className="size-4" /></div>
      case 'name': {
        const priceTags = getNodePriceTags(node, lang)
        return (
          <div key={key} className={`space-y-0.5 ${mutedClass}`}>
            <div className="flex items-center gap-1 text-xs font-semibold">
              {node.region?.trim() ? <img src={`/images/flags/${getRegionCode(node.region)}.svg`} alt={getRegionDisplayName(node.region)} className="size-5 rounded-sm" /> : null}
              <span className="truncate">{node.name}</span>
            </div>
            {priceTags.length > 0
              ? (
                  <div className="truncate text-[11px] text-muted-foreground/70">
                    {priceTags.map((tag, index) => (
                      <span key={tag.id} className={index ? 'ml-1' : ''}>
                        {tag.highlightValue
                          ? (
                              <>
                                <span>{tag.prefix}</span>
                                <span className={getExpireTextClass(node.expired_at)}>{tag.highlightValue}</span>
                                <span>{tag.suffix}</span>
                              </>
                            )
                          : tag.text}
                      </span>
                    ))}
                  </div>
                )
              : null}
          </div>
        )
      }
      case 'tags':
        return (
          <div key={key}>
            <div className="flex flex-wrap items-center gap-1">
              {parseTags(node.tags).map(tag => (
                <Badge key={tag.id} variant="outline" className="rounded border-muted-foreground/10 px-1.5 !text-[11px] text-muted-foreground">{tag.text}</Badge>
              ))}
            </div>
          </div>
        )
      case 'uptime':
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="truncate text-[10px] text-muted-foreground">{formatUptime(node.uptime ?? 0)}</span>
            <button
              type="button"
              className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              aria-label={`${node.name} 延迟 / 丢包`}
              onClick={(event) => {
                event.stopPropagation()
                onPingClick(node)
              }}
            >
              <NodePingListCell uuid={node.uuid} online={node.online} />
            </button>
          </div>
        )
      case 'cpu':
        return (
          <div key={key} className="group">
            <div className="space-y-1">
              <div className="truncate text-[10px] text-muted-foreground">
                <span className="inline group-hover:hidden">
                  {(node.cpu ?? 0).toFixed(1)}
                  %
                </span>
                <span className="hidden group-hover:inline">
                  {(node.load ?? 0).toFixed(2)}
                  ,
                  {' '}
                  {(node.load5 ?? 0).toFixed(2)}
                  ,
                  {' '}
                  {(node.load15 ?? 0).toFixed(2)}
                </span>
              </div>
              <ProgressThin percentage={node.cpu ?? 0} status={getStatus(node.cpu ?? 0)} height={4} />
            </div>
          </div>
        )
      case 'mem': {
        const memPercentage = (node.ram ?? 0) / (node.mem_total || 1) * 100
        return (
          <div key={key} className="group">
            <DataTooltip
              placement="top"
              className="block"
              content={(
                <>
                  <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                    <span className="text-background/70">USED</span>
                    <span>{formatBytes(node.ram ?? 0)}</span>
                  </div>
                  {node.swap
                    ? (
                        <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                          <span className="text-background/70">SWAP</span>
                          <span>{formatBytes(node.swap ?? 0)}</span>
                        </div>
                      )
                    : null}
                </>
              )}
              contentClass="px-1.5 py-1 text-[10px]"
            >
              <div className="space-y-1">
                <div className="truncate text-[10px] text-muted-foreground">
                  <span className="inline group-hover:hidden">
                    {memPercentage.toFixed(1)}
                    %
                  </span>
                  <span className="hidden group-hover:inline">
                    {formatBytes(node.ram ?? 0)}
                    {' '}
                    /
                    {' '}
                    {formatBytes(node.mem_total ?? 0)}
                  </span>
                </div>
                <ProgressThin percentage={memPercentage} status={getStatus(memPercentage)} height={4} />
              </div>
            </DataTooltip>
          </div>
        )
      }
      case 'disk': {
        const diskPercentage = (node.disk ?? 0) / (node.disk_total || 1) * 100
        return (
          <div key={key} className="group">
            <div className="space-y-1">
              <div className="truncate text-[10px] text-muted-foreground">
                <span className="inline group-hover:hidden">
                  {diskPercentage.toFixed(1)}
                  %
                </span>
                <span className="hidden group-hover:inline">
                  {formatBytes(node.disk ?? 0)}
                  {' '}
                  /
                  {' '}
                  {formatBytes(node.disk_total ?? 0)}
                </span>
              </div>
              <ProgressThin percentage={diskPercentage} status={getStatus(diskPercentage)} height={4} />
            </div>
          </div>
        )
      }
      case 'traffic':
        return (
          <div key={key} className="group">
            <DataTooltip
              placement="top"
              className="flex items-center gap-2"
              content={(
                <>
                  <span className="flex items-center gap-0.5 whitespace-nowrap">
                    <Icon icon="tabler:chevron-up" width={12} height={12} />
                    {formatBytes(node.net_total_up ?? 0)}
                  </span>
                  <span className="flex items-center gap-0.5 whitespace-nowrap">
                    <Icon icon="tabler:chevron-down" width={12} height={12} />
                    {formatBytes(node.net_total_down ?? 0)}
                  </span>
                </>
              )}
              contentClass="mb-1.5"
            >
              <div className="w-full space-y-1">
                <div className="truncate text-[10px] text-muted-foreground">
                  <span className="inline group-hover:hidden">
                    {getTrafficUsedPercentage(node).toFixed(1)}
                    %
                  </span>
                  <span className="hidden group-hover:inline">
                    {formatBytes(getTrafficUsed(node))}
                    {' '}
                    /
                    {' '}
                    {node.traffic_limit > 0 ? formatBytes(node.traffic_limit) : '∞'}
                  </span>
                </div>
                <TrafficProgress upload={node.net_total_up ?? 0} download={node.net_total_down ?? 0} trafficLimit={node.traffic_limit} trafficLimitType={node.traffic_limit_type || 'sum'} height="4px" />
              </div>
            </DataTooltip>
          </div>
        )
      case 'rate':
        return (
          <div key={key}>
            <div className="flex flex-col text-[10px]">
              <span className="flex flex-row items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Icon icon="tabler:chevron-up" width={12} height={12} />
                {formatBytesPerSecond(node.net_out ?? 0)}
              </span>
              <span className="flex flex-row items-center gap-1 text-blue-600">
                <Icon icon="tabler:chevron-down" width={12} height={12} />
                {formatBytesPerSecond(node.net_in ?? 0)}
              </span>
            </div>
          </div>
        )
      default:
        return <div key={key} />
    }
  }
}
