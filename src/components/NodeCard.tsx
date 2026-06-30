'use client'

import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/react'
import { Badge } from '@/components/ui/badge'
import { CardX } from '@/components/ui/card-x'
import { ProgressThin } from '@/components/ui/progress-thin'
import { DataTooltip } from '@/components/ui/tooltip'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, getExpireTextClass, parseTags } from '@/utils/tagHelper'

interface PriceTagItem {
  text: string
  highlightValue?: string
  prefix?: string
  suffix?: string
}

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

function getPriceTags(node: NodeData, lang: 'zh-CN' | 'en-US'): PriceTagItem[] {
  const tags: PriceTagItem[] = []
  if (node.price !== 0) {
    const days = getDaysUntilExpired(node.expired_at)
    const status = getExpireStatus(node.expired_at)
    const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
    tags.push({ text: priceText })
    if (status === 'expired')
      tags.push({ text: lang === 'zh-CN' ? '已过期' : 'Expired' })
    else if (status === 'long_term')
      tags.push({ text: lang === 'zh-CN' ? '长期' : 'Long-term' })
    else if (lang === 'zh-CN')
      tags.push({ text: `剩余 ${days} 天`, prefix: '剩余 ', highlightValue: String(days), suffix: ' 天' })
    else
      tags.push({ text: `${days} days left`, highlightValue: String(days), suffix: ' days left' })
  }
  return tags
}

function PingPanel({
  label,
  display,
  tooltip,
  bars,
  node,
  onPingClick,
}: {
  label: string
  display: string
  tooltip: string
  bars: ReturnType<typeof useNodePingDisplay>['latencyRenderBars']
  node: NodeData
  onPingClick: (node: NodeData) => void
}) {
  return (
    <button
      type="button"
      className={`group/panel relative col-span-3 flex h-10 cursor-pointer flex-col gap-1.5 rounded-sm bg-slate-500/5 p-1.5 text-left transition-colors hover:bg-slate-500/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${!node.online ? 'blur-xs opacity-60' : ''}`}
      title={tooltip}
      aria-label={`${node.name} ${label}`}
      onClick={(event) => {
        event.stopPropagation()
        onPingClick(node)
      }}
    >
      <div className="relative flex items-center justify-between gap-2 text-[11px] leading-none">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground/85">{display}</span>
      </div>
      <div
        className="grid h-full items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map(bar => (
          <DataTooltip key={bar.key} placement="top" content={bar.tooltip} className="h-full w-full">
            <span className={`block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/panel:opacity-60 hover:scale-y-160 hover:!opacity-100 ${bar.className}`} />
          </DataTooltip>
        ))}
      </div>
    </button>
  )
}

export default function NodeCard({
  node,
  onClick,
  onPingClick,
}: {
  node: NodeData
  onClick: () => void
  onPingClick: (node: NodeData) => void
}) {
  const byteDecimals = useAppStore(state => state.byteDecimals)
  const lang = useAppStore(state => state.lang)
  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, byteDecimals)
  const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, byteDecimals)
  const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'hour')
  const memPercentage = (node.ram ?? 0) / (node.mem_total || 1) * 100
  const diskPercentage = (node.disk ?? 0) / (node.disk_total || 1) * 100
  const trafficUsed = getTrafficUsed(node)
  const trafficUsedPercentage = node.traffic_limit <= 0 ? 0 : Math.min((trafficUsed / node.traffic_limit) * 100, 100)
  const priceTags = getPriceTags(node, lang)
  const remainingTimeTagClass = node.price === 0 ? '' : getExpireTextClass(node.expired_at)
  const customTags = parseTags(node.tags).map(tag => tag.text)
  const ping = useNodePingDisplay(node.uuid)
  const hasRegion = Boolean(node.region?.trim())

  return (
    <CardX
      hoverable
      className={`node-card h-full w-full cursor-pointer rounded-md border-none bg-background/50 shadow-[0_0_0_3px] shadow-transparent backdrop-blur-sm transition-all duration-200 hover:bg-background hover:shadow-slate-500/10 ${!node.online ? '!shadow-red-600/20' : ''}`}
      onClick={onClick}
      header={(
        <div className="flex min-w-0 items-center gap-2">
          <DataTooltip placement="right" content={formatUptime(node.uptime ?? 0)} className={`relative size-2 rounded-full ${node.online ? 'bg-green-600' : 'bg-red-600'}`} contentClass="whitespace-nowrap">
            <div className={`absolute inset-0 animate-ping rounded-full opacity-50 ${node.online ? 'bg-green-600' : 'bg-red-600'}`} />
          </DataTooltip>
          <span className="text-md min-w-0 flex-1 truncate font-bold">{node.name}</span>
        </div>
      )}
      headerExtra={(
        <div className="flex items-center gap-2">
          <img src={getOSImage(node.os)} alt={getOSName(node.os)} className="size-4" />
          {hasRegion ? <img src={`/images/flags/${getRegionCode(node.region)}.svg`} alt={getRegionDisplayName(node.region)} className="size-5 shrink-0" /> : null}
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="CPU" value={`${(node.cpu ?? 0).toFixed(1)}%`} sub={`${(node.load ?? 0).toFixed(2)}, ${(node.load5 ?? 0).toFixed(2)}, ${(node.load15 ?? 0).toFixed(2)}`} percentage={node.cpu ?? 0} status={getStatus(node.cpu ?? 0)} />
          <Metric label="内存" value={`${memPercentage.toFixed(1)}%`} sub={`${formatBytes(node.ram ?? 0)} / ${formatBytes(node.mem_total ?? 0)}`} percentage={memPercentage} status={getStatus(memPercentage)} />
          <Metric label="硬盘" value={`${diskPercentage.toFixed(1)}%`} sub={`${formatBytes(node.disk ?? 0)} / ${formatBytes(node.disk_total ?? 0)}`} percentage={diskPercentage} status={getStatus(diskPercentage)} />
          <Metric label="流量" value={`${trafficUsedPercentage.toFixed(1)}%`} sub={`${formatBytes(trafficUsed)} / ${node.traffic_limit > 0 ? formatBytes(node.traffic_limit) : '∞'}`} percentage={trafficUsedPercentage} status="success" />
        </div>

        <div className="relative grid grid-cols-6 gap-1.5">
          {!node.online
            ? (
                <div className="absolute inset-0 z-1 flex flex-col items-center justify-center gap-1 text-center" aria-hidden="true">
                  <div className="text-sm font-medium text-destructive">离线</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(node.time)}</div>
                </div>
              )
            : null}
          <InfoBlock className={priceTags.length ? 'col-span-2' : 'col-span-3'} muted={!node.online}>
            <span className="flex flex-row items-center gap-1 text-green-600">
              <Icon icon="tabler:chevron-up" width={12} height={12} />
              {formatBytesPerSecond(node.net_out ?? 0)}
            </span>
            <span className="flex flex-row items-center gap-1 text-blue-600">
              <Icon icon="tabler:chevron-down" width={12} height={12} />
              {formatBytesPerSecond(node.net_in ?? 0)}
            </span>
          </InfoBlock>
          <InfoBlock className={priceTags.length ? 'col-span-2' : 'col-span-3'} muted={!node.online}>
            <span className="flex flex-row items-center gap-1">
              <Icon icon="tabler:upload" width={12} height={12} />
              {formatBytes(node.net_total_up ?? 0)}
            </span>
            <span className="flex flex-row items-center gap-1">
              <Icon icon="tabler:download" width={12} height={12} />
              {formatBytes(node.net_total_down ?? 0)}
            </span>
          </InfoBlock>
          {priceTags.length
            ? (
                <InfoBlock className="col-span-2" muted={!node.online}>
                  {priceTags.map((tag, index) => (
                    <span key={`${tag.text}-${index}`} className="flex flex-row items-center gap-1">
                      {tag.highlightValue
                        ? (
                            <>
                              <span>{tag.prefix}</span>
                              <span className={remainingTimeTagClass}>{tag.highlightValue}</span>
                              <span>{tag.suffix}</span>
                            </>
                          )
                        : tag.text}
                    </span>
                  ))}
                </InfoBlock>
              )
            : null}
          <PingPanel label="延迟" display={ping.latencyDisplay} tooltip={ping.latencyPanelTooltip} bars={ping.latencyRenderBars} node={node} onPingClick={onPingClick} />
          <PingPanel label="丢包" display={ping.lossDisplay} tooltip={ping.lossPanelTooltip} bars={ping.lossRenderBars} node={node} onPingClick={onPingClick} />
        </div>
        {customTags.length > 0
          ? (
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                {customTags.map((tag, index) => (
                  <Badge key={`${tag}-${index}`} variant="outline" className="rounded border-muted-foreground/10 px-1.5 !text-[11px] text-muted-foreground">{tag}</Badge>
                ))}
              </div>
            )
          : null}
      </div>
    </CardX>
  )
}

function Metric({ label, value, sub, percentage, status }: { label: string, value: string, sub: string, percentage: number, status: 'success' | 'warning' | 'danger' | 'error' | 'normal' }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex w-full flex-row justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
      <ProgressThin percentage={percentage} status={status} height={4} />
      <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function InfoBlock({ children, className, muted }: { children: React.ReactNode, className?: string, muted?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-sm bg-slate-500/5 p-1 pl-2 text-[11px] text-muted-foreground ${className ?? ''} ${muted ? 'blur-xs opacity-60' : ''}`}>
      {children}
    </div>
  )
}
