'use client'

import type { NodeData } from '@/stores/nodes'
import type { CurrencyCode } from '@/utils/financeHelper'
import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'
import LoadChart from '@/components/LoadChart'
import PingChart from '@/components/PingChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { ProgressThin } from '@/components/ui/progress-thin'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { navigateTo } from '@/utils/navigation'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { getBillingCycleText, getExpireText, getExpireTextClass } from '@/utils/tagHelper'

interface InfoItem {
  label: string
  value: string | undefined
  icon?: string
}

interface MetricCard {
  label: string
  value: string
  unit?: string
  icon: string
  valueClass?: string
}

interface StatusCard {
  label: string
  value: string
  unit?: string
  icon: string
  subtitle?: string
  percentage?: number
}

const EXPIRES_IN_SUFFIX_REGEX = /^(\d+)\s*(天|days?)$/i
const CURRENCY_SUFFIX_REGEX = /^(\S.*\S)\s+([A-Z]{3})$/
const TRAILING_DECIMAL_ZEROS_REGEX = /\.?0+$/

function formatPercentage(value: number | undefined): string {
  const safeValue = Number.isFinite(value) ? value ?? 0 : 0
  const decimals = Math.abs(safeValue) >= 10 ? 1 : 2
  return safeValue.toFixed(decimals).replace(TRAILING_DECIMAL_ZEROS_REGEX, '')
}

function getUsedPercentage(used: number | undefined, total: number | undefined): number {
  if (!total || total <= 0)
    return 0
  return Math.min(Math.max(((used ?? 0) / total) * 100, 0), 100)
}

function formatLoadValue(value: number | undefined): string {
  if (!Number.isFinite(value))
    return '0'
  return (value ?? 0).toFixed(2).replace(TRAILING_DECIMAL_ZEROS_REGEX, '')
}

function splitMetricValue(value: string): { value: string, unit?: string } {
  const cycleIndex = value.indexOf(' / ')
  if (cycleIndex > -1)
    return { value: value.slice(0, cycleIndex), unit: value.slice(cycleIndex) }
  const expiresInMatch = value.match(EXPIRES_IN_SUFFIX_REGEX)
  if (expiresInMatch)
    return { value: expiresInMatch[1] ?? value, unit: expiresInMatch[2] ?? undefined }
  const currencyMatch = value.match(CURRENCY_SUFFIX_REGEX)
  if (currencyMatch)
    return { value: currencyMatch[1] ?? value, unit: currencyMatch[2] ?? undefined }
  return { value }
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

export default function InstanceDetail({ id }: { id: string }) {
  const data = useNodesStore(state => state.nodes.find(node => node.uuid === id))
  const byteDecimals = useAppStore(state => state.byteDecimals)
  const lang = useAppStore(state => state.lang)
  const [exchangeRates, setExchangeRates] = useState(financeHelper.DEFAULT_EXCHANGE_RATES)
  const [financeBaseCurrency, setFinanceBaseCurrency] = useState<CurrencyCode>('CNY')
  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, byteDecimals)
  const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, byteDecimals)
  const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'minute')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    setFinanceBaseCurrency(financeHelper.getStoredFinanceCurrency())
    financeHelper.getDailyExchangeRates()
      .then(({ rates }) => setExchangeRates(rates))
      .catch(() => {})
  }, [])

  const formatFinanceMetricValue = (amountCNY: number, currency: CurrencyCode): string => {
    const targetRate = exchangeRates[currency] || 1
    const formattedValue = financeHelper.formatFinanceAmount(amountCNY * targetRate, currency)
    return `${formattedValue.symbol}${formattedValue.value} ${formattedValue.currency}`
  }

  const financeCards = useMemo<MetricCard[]>(() => {
    if (!data)
      return []
    const priceCNY = financeHelper.calculateValueCNY(data, exchangeRates)
    const nodePriceText = priceCNY <= 0
      ? formatFinanceMetricValue(0, financeBaseCurrency)
      : `${formatFinanceMetricValue(priceCNY, financeBaseCurrency)} / ${getBillingCycleText(data.billing_cycle, lang)}`
    const monthlyAverageCostText = Number(data.billing_cycle) <= 0
      ? lang === 'zh-CN' ? '不适用' : 'N/A'
      : `${formatFinanceMetricValue(financeHelper.calculateMonthlyAverageCostCNY(data, exchangeRates), financeBaseCurrency)} / 月`
    const remainingTimeText = data.expired_at ? getExpireText(data.expired_at, lang) : '-'
    const remainingValueText = formatFinanceMetricValue(financeHelper.calculateRemainingValueCNY(data, exchangeRates), financeBaseCurrency)
    const nodePrice = splitMetricValue(nodePriceText)
    const monthlyAverageCost = splitMetricValue(monthlyAverageCostText)
    const remainingTime = splitMetricValue(remainingTimeText)
    const remainingValue = splitMetricValue(remainingValueText)

    return [
      { label: '节点价格', value: nodePrice.value, unit: nodePrice.unit, icon: 'tabler:cash' },
      { label: '月均支出', value: monthlyAverageCost.value, unit: monthlyAverageCost.unit, icon: 'tabler:receipt-2' },
      { label: '剩余时间', value: remainingTime.value, unit: remainingTime.unit, icon: 'tabler:calendar-dollar', valueClass: data.expired_at ? getExpireTextClass(data.expired_at) : '' },
      { label: '剩余价值', value: remainingValue.value, unit: remainingValue.unit, icon: 'tabler:coins' },
    ]
  }, [data, exchangeRates, financeBaseCurrency, lang])

  if (!data) {
    return (
      <div className="instance-detail space-y-4">
        <div className="p-4">
          <CardX className="rounded-md border-none bg-background/50 backdrop-blur-xs transition-all hover:bg-background">
            <Empty description="节点不存在或已被删除">
              <Button onClick={() => navigateTo('/')}>返回首页</Button>
            </Empty>
          </CardX>
        </div>
      </div>
    )
  }

  const hardwareInfo: InfoItem[] = [
    { label: 'CPU', value: `${data.cpu_name} (x${data.cpu_cores})`, icon: 'icon-park-outline:cpu' },
    { label: '架构', value: data.arch ?? '-', icon: 'icon-park-outline:application-two' },
    { label: '虚拟化', value: data.virtualization ?? '-', icon: 'icon-park-outline:server' },
    { label: 'GPU', value: data.gpu_name || '-', icon: 'icon-park-outline:video-one' },
  ]
  const systemInfo: InfoItem[] = [
    { label: '操作系统', value: data.os ?? '-', icon: 'icon-park-outline:computer' },
    { label: '内核版本', value: data.kernel_version ?? '-', icon: 'icon-park-outline:code' },
    { label: '运行时间', value: formatUptime(data.uptime ?? 0), icon: 'icon-park-outline:timer' },
    { label: '最后上报', value: formatDateTime(data.time), icon: 'icon-park-outline:time' },
  ]
  const storageInfo: InfoItem[] = [
    { label: '内存', value: `${formatBytes(data.ram ?? 0)} / ${formatBytes(data.mem_total ?? 0)}`, icon: 'icon-park-outline:memory' },
    { label: '内存交换', value: `${formatBytes(data.swap ?? 0)} / ${formatBytes(data.swap_total ?? 0)}`, icon: 'icon-park-outline:switch' },
    { label: '硬盘', value: `${formatBytes(data.disk ?? 0)} / ${formatBytes(data.disk_total ?? 0)}`, icon: 'icon-park-outline:hard-disk' },
  ]
  const trafficUsed = getTrafficUsed(data)
  const hasTrafficLimit = (data.traffic_limit ?? 0) > 0
  const trafficUsedPercentage = data.traffic_limit <= 0 ? 0 : Math.min((trafficUsed / data.traffic_limit) * 100, 100)
  const trafficUsageText = hasTrafficLimit ? `${formatBytes(trafficUsed)} / ${formatBytes(data.traffic_limit ?? 0)}` : '无限流量'
  const memoryUsagePercentage = getUsedPercentage(data.ram, data.mem_total)
  const swapUsagePercentage = getUsedPercentage(data.swap, data.swap_total)
  const diskUsagePercentage = getUsedPercentage(data.disk, data.disk_total)
  const loadText = [data.load, data.load5, data.load15].map(formatLoadValue).join(' / ')
  const statusCards: StatusCard[] = [
    {
      label: 'CPU',
      value: formatPercentage(data.cpu ?? 0),
      unit: '%',
      icon: 'icon-park-outline:cpu',
      subtitle: `负载 ${loadText}`,
      percentage: data.cpu ?? 0,
    },
    {
      label: '内存',
      value: formatBytes(data.ram ?? 0),
      unit: `/ ${formatBytes(data.mem_total ?? 0)}`,
      icon: 'icon-park-outline:memory',
      subtitle: `已用 ${formatPercentage(memoryUsagePercentage)}%`,
      percentage: memoryUsagePercentage,
    },
    {
      label: '交换',
      value: formatBytes(data.swap ?? 0),
      unit: `/ ${formatBytes(data.swap_total ?? 0)}`,
      icon: 'icon-park-outline:switch',
      subtitle: `已用 ${formatPercentage(swapUsagePercentage)}%`,
      percentage: swapUsagePercentage,
    },
    {
      label: '硬盘',
      value: formatBytes(data.disk ?? 0),
      unit: `/ ${formatBytes(data.disk_total ?? 0)}`,
      icon: 'icon-park-outline:hard-disk',
      subtitle: `已用 ${formatPercentage(diskUsagePercentage)}%`,
      percentage: diskUsagePercentage,
    },
    {
      label: '实时上行',
      value: formatBytesPerSecond(data.net_out ?? 0),
      icon: 'tabler:arrow-up-right',
      subtitle: `累计 ${formatBytes(data.net_total_up ?? 0)}`,
    },
    {
      label: '实时下行',
      value: formatBytesPerSecond(data.net_in ?? 0),
      icon: 'tabler:arrow-down-right',
      subtitle: `累计 ${formatBytes(data.net_total_down ?? 0)}`,
    },
    {
      label: '总流量',
      value: formatBytes(trafficUsed),
      unit: hasTrafficLimit ? `/ ${formatBytes(data.traffic_limit ?? 0)}` : undefined,
      icon: 'icon-park-outline:transfer-data',
      subtitle: hasTrafficLimit ? `已用 ${formatPercentage(trafficUsedPercentage)}%` : '无限流量',
      percentage: hasTrafficLimit ? trafficUsedPercentage : undefined,
    },
    {
      label: '连接',
      value: String(data.connections ?? 0),
      unit: `TCP / ${data.connections_udp ?? 0} UDP`,
      icon: 'icon-park-outline:connect',
      subtitle: `进程 ${data.process ?? 0}`,
    },
  ]

  return (
    <div className="instance-detail space-y-4">
      <div className="flex items-center gap-4 px-4">
        <Button variant="ghost" size="icon-sm" className="bg-background/50 hover:bg-background" onClick={() => navigateTo('/')}>
          <Icon icon="tabler:arrow-left" width={16} height={16} />
        </Button>
        <div className="flex items-center gap-2 text-lg font-bold">
          <img src={`/images/flags/${getRegionCode(data.region)}.svg`} alt={getRegionDisplayName(data.region)} className="size-6" />
          <span>{data.name}</span>
        </div>
        <Badge variant={data.online ? 'default' : 'destructive'} className="!rounded text-xs">
          {data.online ? '在线' : '离线'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4">
        {statusCards.map(item => (
          <StatusMetricCard key={item.label} item={item} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 px-4 lg:grid-cols-4">
        {financeCards.map(item => (
          <CardX key={item.label} hoverable className="group h-full rounded-md border-none bg-background/50 backdrop-blur-xs transition-all hover:bg-background">
            <div className="flex h-full min-h-10 flex-col justify-between gap-3 md:min-h-18">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">{item.label}</span>
                <Icon icon={item.icon} width={20} height={20} className="text-slate-500/25 transition-colors group-hover:text-slate-500" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className={`flex min-w-0 items-baseline gap-1 truncate leading-none font-semibold ${item.valueClass ?? ''}`}>
                  <span className="truncate text-base sm:text-2xl">{item.value}</span>
                  {item.unit ? <span className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">{item.unit}</span> : null}
                </div>
              </div>
            </div>
          </CardX>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2">
        <InfoCard title="硬件信息" items={hardwareInfo} firstWide />
        <InfoCard title="系统信息" items={systemInfo} data={data} />
        <InfoCard title="存储信息" items={storageInfo} columns="grid-cols-3" />
        <CardX className="group h-full rounded-md border-none bg-background/50 backdrop-blur-xs transition-all hover:bg-background">
          <div className="mb-3 text-sm font-semibold">网络信息</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative min-w-0 overflow-hidden rounded-sm bg-slate-500/5 p-2">
              {hasTrafficLimit ? <div className="pointer-events-none absolute inset-y-0 left-0 rounded-sm bg-primary/10 transition-[width] duration-300 ease-out" style={{ width: `${trafficUsedPercentage}%` }} /> : null}
              <div className="relative flex flex-col gap-1.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Icon icon="icon-park-outline:transfer-data" width={14} height={14} />
                  <span className="text-xs sm:text-sm">总流量</span>
                  <div className="flex-1" />
                  <span className="hidden text-[11px] font-medium text-foreground/70 sm:block">
                    {formatBytes(data.net_total_up ?? 0)}
                    {' '}
                    /
                    {' '}
                    {formatBytes(data.net_total_down ?? 0)}
                  </span>
                </div>
                <span className="break-all text-xs sm:text-sm">{trafficUsageText}</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-sm bg-slate-500/5 p-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Icon icon="icon-park-outline:dashboard-one" width={14} height={14} />
                <span className="text-xs sm:text-sm">网络速率</span>
              </div>
              <span className="flex flex-row flex-wrap items-center gap-1 break-all text-xs sm:text-sm">
                <Icon icon="tabler:chevron-up" width={12} height={12} />
                {formatBytesPerSecond(data.net_out ?? 0)}
                <span className="px-0.5" />
                <Icon icon="tabler:chevron-down" width={12} height={12} />
                {formatBytesPerSecond(data.net_in ?? 0)}
              </span>
            </div>
          </div>
        </CardX>
      </div>

      <LoadChart uuid={data.uuid} className="px-4" />
      <PingChart uuid={data.uuid} className="px-4" />
    </div>
  )
}

function StatusMetricCard({ item }: { item: StatusCard }) {
  const hasProgress = typeof item.percentage === 'number'

  return (
    <CardX hoverable className="group h-full rounded-md border-none bg-background/50 backdrop-blur-xs transition-all hover:bg-background">
      <div className="flex h-full min-h-26 flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-medium tracking-wider text-muted-foreground">{item.label}</span>
          <Icon icon={item.icon} width={20} height={20} className="shrink-0 text-slate-500/25 transition-colors group-hover:text-slate-500" />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-baseline gap-1 leading-none font-semibold">
            <span className="min-w-0 truncate text-base sm:text-2xl">{item.value}</span>
            {item.unit ? <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{item.unit}</span> : null}
          </div>
          {item.subtitle ? <div className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{item.subtitle}</div> : null}
        </div>
        {hasProgress ? <ProgressThin percentage={item.percentage ?? 0} status={getStatus(item.percentage ?? 0)} height={4} /> : null}
      </div>
    </CardX>
  )
}

function InfoCard({ title, items, firstWide, columns = 'grid-cols-1 sm:grid-cols-2', data }: { title: string, items: InfoItem[], firstWide?: boolean, columns?: string, data?: NodeData }) {
  return (
    <CardX className="group h-full rounded-md border-none bg-background/50 backdrop-blur-xs transition-all hover:bg-background">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className={`grid gap-3 ${columns}`}>
        {items.map((item, index) => (
          <div key={item.label} className={`flex min-w-0 flex-col gap-1 rounded-sm bg-slate-500/5 p-2 ${firstWide && index === 0 ? 'col-span-full' : ''}`}>
            <div className="flex items-center gap-1 text-muted-foreground">
              {item.icon ? <Icon icon={item.icon} width={14} height={14} /> : null}
              <span className="text-xs sm:text-sm">{item.label}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {item.label === '操作系统' && data ? <img src={getOSImage(data.os)} alt={getOSName(data.os)} className="size-5 shrink-0" /> : null}
              <span className="break-all text-xs sm:text-sm">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </CardX>
  )
}
