'use client'

import type { NodeData } from '@/stores/nodes'
import type { CurrencyCode } from '@/utils/financeHelper'
import { Icon } from '@iconify/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import LoadChart from '@/components/LoadChart'
import PingChart from '@/components/PingChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { ProgressThin } from '@/components/ui/progress-thin'
import { useI18n } from '@/composables/useI18n'
import { toRegionLanguage } from '@/i18n'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatTemperature, formatUptimeWithFormat, getStatus, isTemperatureAvailable } from '@/utils/helper'
import { navigateTo } from '@/utils/navigation'
import { getTrafficUsed, getTrafficUsedPercentage, hasTrafficLimit as nodeHasTrafficLimit } from '@/utils/nodeHelpers'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { getBillingCycleText, getExpireText, getExpireTextClass } from '@/utils/tagHelper'

interface InfoItem {
  id: string
  label: string
  value: string | undefined
  icon?: string
  /** Render the OS image on this row; alt text comes from osAlt. */
  osIcon?: boolean
  osAlt?: string
}

interface MetricCard {
  id: string
  label: string
  value: string
  unit?: string
  icon: string
  valueClass?: string
}

interface StatusCard {
  id: string
  label: string
  value: string
  unit?: string
  icon: string
  subtitle?: string
  percentage?: number
}

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

export default function InstanceDetail({ id }: { id: string }) {
  const data = useNodesStore(state => state.nodes.find(node => node.uuid === id))
  const byteDecimals = useAppStore(state => state.byteDecimals)
  const { lang, t } = useI18n()
  const [exchangeRates, setExchangeRates] = useState(financeHelper.DEFAULT_EXCHANGE_RATES)
  const [financeBaseCurrency, setFinanceBaseCurrency] = useState<CurrencyCode>('CNY')
  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, byteDecimals)
  const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, byteDecimals)
  const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'minute', lang)

  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Persisted browser settings must hydrate after SSR to avoid an initial markup mismatch.
    setFinanceBaseCurrency(financeHelper.getStoredFinanceCurrency())
    financeHelper.getDailyExchangeRates()
      .then(({ rates }) => setExchangeRates(rates))
      .catch(() => {})
  }, [])

  const formatFinanceMetricValue = useCallback((amountCNY: number, currency: CurrencyCode): { text: string, currency: CurrencyCode } => {
    const targetRate = exchangeRates[currency] || 1
    const formatted = financeHelper.formatFinanceAmount(amountCNY * targetRate, currency, lang)
    return { text: `${formatted.symbol}${formatted.value}`, currency: formatted.currency }
  }, [exchangeRates, lang])

  const financeCards = useMemo<MetricCard[]>(() => {
    if (!data)
      return []
    const priceCNY = financeHelper.calculateValueCNY(data, exchangeRates)
    const hasBillingCycle = Number(data.billing_cycle) > 0
    const priceAmount = formatFinanceMetricValue(priceCNY <= 0 ? 0 : priceCNY, financeBaseCurrency)
    const monthlyAmount = hasBillingCycle
      ? formatFinanceMetricValue(financeHelper.calculateMonthlyAverageCostCNY(data, exchangeRates), financeBaseCurrency)
      : undefined
    const remainingValueAmount = formatFinanceMetricValue(financeHelper.calculateRemainingValueCNY(data, exchangeRates), financeBaseCurrency)

    return [
      {
        id: 'node-price',
        label: t('detail.nodePrice'),
        value: `${priceAmount.text} ${priceAmount.currency}`,
        unit: priceCNY > 0 ? `/ ${getBillingCycleText(data.billing_cycle, lang)}` : undefined,
        icon: 'tabler:cash',
      },
      {
        id: 'monthly-spend',
        label: t('detail.monthlySpend'),
        value: monthlyAmount ? `${monthlyAmount.text} ${monthlyAmount.currency}` : t('detail.notApplicable'),
        unit: monthlyAmount ? t('summary.perMonth') : undefined,
        icon: 'tabler:receipt-2',
      },
      {
        id: 'remaining-time',
        label: t('detail.remainingTime'),
        value: data.expired_at ? getExpireText(data.expired_at, lang) : '-',
        icon: 'tabler:calendar-dollar',
        valueClass: data.expired_at ? getExpireTextClass(data.expired_at) : '',
      },
      {
        id: 'remaining-value',
        label: t('detail.remainingValue'),
        value: remainingValueAmount.text,
        unit: remainingValueAmount.currency,
        icon: 'tabler:coins',
      },
    ]
  }, [data, exchangeRates, financeBaseCurrency, formatFinanceMetricValue, lang, t])

  if (!data) {
    return (
      <div className="instance-detail space-y-4">
        <div className="p-4">
          <CardX className="rounded-2xl bg-card">
            <Empty description={t('detail.notFound')}>
              <Button onClick={() => navigateTo('/')}>{t('common.backHome')}</Button>
            </Empty>
          </CardX>
        </div>
      </div>
    )
  }

  const hasOs = data.os.trim().length > 0
  const unknownOsLabel = t('node.unknownOs')

  const hardwareInfo: InfoItem[] = [
    { id: 'cpu', label: 'CPU', value: `${data.cpu_name} (x${data.cpu_cores})`, icon: 'icon-park-outline:cpu' },
    { id: 'arch', label: t('detail.architecture'), value: data.arch ?? '-', icon: 'icon-park-outline:application-two' },
    { id: 'virtualization', label: t('detail.virtualization'), value: data.virtualization ?? '-', icon: 'icon-park-outline:server' },
    { id: 'gpu', label: 'GPU', value: data.gpu_name || '-', icon: 'icon-park-outline:video-one' },
  ]
  if (isTemperatureAvailable(data.temp)) {
    hardwareInfo.push({
      id: 'temperature',
      label: t('node.temperature'),
      value: formatTemperature(data.temp),
      icon: 'icon-park-outline:thermometer',
    })
  }
  const systemInfo: InfoItem[] = [
    { id: 'os', label: t('detail.operatingSystem'), value: hasOs ? data.os : unknownOsLabel, icon: 'icon-park-outline:computer', osIcon: true, osAlt: hasOs ? getOSName(data.os) : unknownOsLabel },
    { id: 'kernel', label: t('detail.kernelVersion'), value: data.kernel_version ?? '-', icon: 'icon-park-outline:code' },
    { id: 'uptime', label: t('node.uptime'), value: formatUptime(data.uptime ?? 0), icon: 'icon-park-outline:timer' },
    { id: 'last-report', label: t('detail.lastReport'), value: formatDateTime(data.time, 'full', lang), icon: 'icon-park-outline:time' },
  ]
  const storageInfo: InfoItem[] = [
    { id: 'memory', label: t('node.memory'), value: `${formatBytes(data.ram ?? 0)} / ${formatBytes(data.mem_total ?? 0)}`, icon: 'icon-park-outline:memory' },
    { id: 'swap', label: t('detail.swapMemory'), value: `${formatBytes(data.swap ?? 0)} / ${formatBytes(data.swap_total ?? 0)}`, icon: 'icon-park-outline:switch' },
    { id: 'disk', label: t('node.disk'), value: `${formatBytes(data.disk ?? 0)} / ${formatBytes(data.disk_total ?? 0)}`, icon: 'icon-park-outline:hard-disk' },
  ]
  const trafficUsed = getTrafficUsed(data)
  const hasTrafficLimit = nodeHasTrafficLimit(data)
  const trafficUsedPercentage = getTrafficUsedPercentage(data)
  const trafficUsageText = hasTrafficLimit ? `${formatBytes(trafficUsed)} / ${formatBytes(data.traffic_limit ?? 0)}` : t('common.unlimitedTraffic')
  const memoryUsagePercentage = getUsedPercentage(data.ram, data.mem_total)
  const swapUsagePercentage = getUsedPercentage(data.swap, data.swap_total)
  const diskUsagePercentage = getUsedPercentage(data.disk, data.disk_total)
  const loadText = [data.load, data.load5, data.load15].map(formatLoadValue).join(' / ')
  const statusCards: StatusCard[] = [
    {
      id: 'cpu',
      label: 'CPU',
      value: formatPercentage(data.cpu ?? 0),
      unit: '%',
      icon: 'icon-park-outline:cpu',
      subtitle: t('detail.load', { value: loadText }),
      percentage: data.cpu ?? 0,
    },
    {
      id: 'memory',
      label: t('node.memory'),
      value: formatBytes(data.ram ?? 0),
      unit: `/ ${formatBytes(data.mem_total ?? 0)}`,
      icon: 'icon-park-outline:memory',
      subtitle: t('detail.usedPercent', { value: formatPercentage(memoryUsagePercentage) }),
      percentage: memoryUsagePercentage,
    },
    {
      id: 'swap',
      label: t('detail.swap'),
      value: formatBytes(data.swap ?? 0),
      unit: `/ ${formatBytes(data.swap_total ?? 0)}`,
      icon: 'icon-park-outline:switch',
      subtitle: t('detail.usedPercent', { value: formatPercentage(swapUsagePercentage) }),
      percentage: swapUsagePercentage,
    },
    {
      id: 'disk',
      label: t('node.disk'),
      value: formatBytes(data.disk ?? 0),
      unit: `/ ${formatBytes(data.disk_total ?? 0)}`,
      icon: 'icon-park-outline:hard-disk',
      subtitle: t('detail.usedPercent', { value: formatPercentage(diskUsagePercentage) }),
      percentage: diskUsagePercentage,
    },
    {
      id: 'upload',
      label: t('detail.liveUpload'),
      value: formatBytesPerSecond(data.net_out ?? 0),
      icon: 'tabler:arrow-up-right',
      subtitle: t('detail.accumulated', { value: formatBytes(data.net_total_up ?? 0) }),
    },
    {
      id: 'download',
      label: t('detail.liveDownload'),
      value: formatBytesPerSecond(data.net_in ?? 0),
      icon: 'tabler:arrow-down-right',
      subtitle: t('detail.accumulated', { value: formatBytes(data.net_total_down ?? 0) }),
    },
    {
      id: 'traffic',
      label: t('detail.totalTraffic'),
      value: formatBytes(trafficUsed),
      unit: hasTrafficLimit ? `/ ${formatBytes(data.traffic_limit ?? 0)}` : undefined,
      icon: 'icon-park-outline:transfer-data',
      subtitle: hasTrafficLimit ? t('detail.usedPercent', { value: formatPercentage(trafficUsedPercentage) }) : t('common.unlimitedTraffic'),
      percentage: hasTrafficLimit ? trafficUsedPercentage : undefined,
    },
    {
      id: 'connections',
      label: t('detail.connections'),
      value: String(data.connections ?? 0),
      unit: `TCP / ${data.connections_udp ?? 0} UDP`,
      icon: 'icon-park-outline:connect',
      subtitle: t('detail.processes', { count: data.process ?? 0 }),
    },
  ]

  return (
    <div className="instance-detail space-y-4">
      <div className="flex items-center gap-4 px-4">
        <Button variant="ghost" size="icon-sm" aria-label={t('common.backHome')} className="bg-background hover:bg-accent" onClick={() => navigateTo('/')}>
          <Icon icon="tabler:arrow-left" width={16} height={16} />
        </Button>
        <div className="flex items-center gap-2 text-lg font-bold">
          <img src={`/images/flags/${getRegionCode(data.region)}.svg`} alt={getRegionDisplayName(data.region, toRegionLanguage(lang))} className="size-6" />
          <h2>{data.name}</h2>
        </div>
        <Badge variant={data.online ? 'default' : 'destructive'} className="!rounded text-xs">
          {data.online ? t('common.online') : t('common.offline')}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4">
        {statusCards.map(item => (
          <StatusMetricCard key={item.id} item={item} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 px-4 lg:grid-cols-4">
        {financeCards.map(item => (
          <CardX key={item.id} interaction="subtle" className="group h-full rounded-2xl bg-card">
            <div className="flex h-full min-h-10 flex-col justify-between gap-3 md:min-h-18">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">{item.label}</span>
                <Icon icon={item.icon} width={20} height={20} className="text-muted-foreground/40 transition-colors group-hover:text-foreground/70" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className={`flex min-w-0 items-baseline gap-1 truncate leading-none font-semibold ${item.valueClass ?? ''}`}>
                  <span className="vercel-number truncate text-base sm:text-2xl">{item.value}</span>
                  {item.unit ? <span className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">{item.unit}</span> : null}
                </div>
              </div>
            </div>
          </CardX>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2">
        <InfoCard title={t('detail.hardwareInfo')} items={hardwareInfo} firstWide />
        <InfoCard title={t('detail.systemInfo')} items={systemInfo} data={data} />
        <InfoCard title={t('detail.storageInfo')} items={storageInfo} columns="grid-cols-3" />
        <CardX className="group h-full rounded-2xl bg-card">
          <h3 className="mb-3 text-sm font-semibold">{t('detail.networkInfo')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="vercel-subtle relative min-w-0 overflow-hidden rounded-sm border border-transparent p-2">
              {hasTrafficLimit ? <div className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left rounded-sm bg-primary/10 transition-transform duration-300 ease-out" style={{ transform: `scaleX(${trafficUsedPercentage / 100})` }} /> : null}
              <div className="relative flex flex-col gap-1.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Icon icon="icon-park-outline:transfer-data" width={14} height={14} />
                  <span className="text-xs sm:text-sm">{t('detail.totalTraffic')}</span>
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
            <div className="vercel-subtle flex min-w-0 flex-col gap-1 rounded-sm border border-transparent p-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Icon icon="icon-park-outline:dashboard-one" width={14} height={14} />
                <span className="text-xs sm:text-sm">{t('detail.networkRate')}</span>
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
    <CardX interaction="subtle" className="group h-full rounded-2xl bg-card">
      <div className="flex h-full min-h-26 flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-medium tracking-wider text-muted-foreground">{item.label}</span>
          <Icon icon={item.icon} width={20} height={20} className="shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground/70" />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-baseline gap-1 leading-none font-semibold">
            <span className="vercel-number min-w-0 truncate text-base sm:text-2xl">{item.value}</span>
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
    <CardX className="group h-full rounded-2xl bg-card">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className={`grid gap-3 ${columns}`}>
        {items.map((item, index) => (
          <div key={item.id} className={`vercel-subtle flex min-w-0 flex-col gap-1 rounded-sm border border-transparent p-2 ${firstWide && index === 0 ? 'col-span-full' : ''}`}>
            <div className="flex items-center gap-1 text-muted-foreground">
              {item.icon ? <Icon icon={item.icon} width={14} height={14} /> : null}
              <span className="text-xs sm:text-sm">{item.label}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {item.osIcon && data ? <img src={getOSImage(data.os)} alt={item.osAlt ?? ''} className="size-5 shrink-0" /> : null}
              <span className="break-all text-xs sm:text-sm">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </CardX>
  )
}
