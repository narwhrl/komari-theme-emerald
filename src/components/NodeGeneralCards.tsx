'use client'

import type { KeyboardEvent } from 'react'
import type { NodeData } from '@/stores/nodes'
import type { CurrencyCode } from '@/utils/financeHelper'
import { Icon } from '@iconify/react'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CardX } from '@/components/ui/card-x'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTooltip } from '@/components/ui/tooltip'
import { useAppDerived, useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondSplit, formatBytesSplit } from '@/utils/helper'

const financeRateCurrencies: readonly CurrencyCode[] = financeHelper.DISPLAY_FINANCE_CURRENCIES

function NodeEarthGlobeFallback() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden -translate-y-4 lg:-translate-y-8" role="status" aria-label="正在加载">
      <Skeleton className="absolute inset-0 h-full w-full rounded-full" />
    </div>
  )
}

function NodeEarthMapsFallback() {
  return (
    <div className="relative h-full" role="status" aria-label="正在加载">
      <div className="relative flex h-88 flex-col items-center">
        <div className="relative w-full flex-1 -translate-y-1/5 md:-translate-y-1/6">
          <Skeleton className="h-full w-full rounded-full opacity-80" />
        </div>
      </div>
    </div>
  )
}

const NodeEarthGlobe = dynamic(() => import('@/components/NodeEarthGlobe'), {
  loading: NodeEarthGlobeFallback,
})
const NodeEarthMaps = dynamic(() => import('@/components/NodeEarthMaps'), {
  loading: NodeEarthMapsFallback,
})

export default function NodeGeneralCards({
  nodes,
  globeNodes,
  transitionKey = 'all',
}: {
  nodes?: NodeData[]
  globeNodes?: NodeData[]
  transitionKey?: string
}) {
  const allNodes = useNodesStore(state => state.nodes)
  const byteDecimals = useAppStore(state => state.byteDecimals)
  const { earthViewMode } = useAppDerived()
  const summaryNodes = nodes ?? allNodes
  const [exchangeRates, setExchangeRates] = useState(financeHelper.DEFAULT_EXCHANGE_RATES)
  const [exchangeRateBaseCurrency, setExchangeRateBaseCurrency] = useState<CurrencyCode>('CNY')
  const [excludeFreeNodes, setExcludeFreeNodes] = useState(true)
  const [openFinanceCard, setOpenFinanceCard] = useState(false)
  const financeTriggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Persisted browser settings must hydrate after SSR to avoid an initial markup mismatch.
    setExchangeRateBaseCurrency(financeHelper.getStoredFinanceCurrency())
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- Persisted browser settings must hydrate after SSR to avoid an initial markup mismatch.
    setExcludeFreeNodes(financeHelper.shouldExcludeFreeNodes())
    financeHelper.getDailyExchangeRates()
      .then(({ rates }) => setExchangeRates(rates))
      .catch(() => {})
  }, [])

  const totalSpeed = useMemo(() => {
    const onlineNodes = summaryNodes.filter(node => node.online)
    const up = onlineNodes.reduce((sum, node) => sum + (node.net_out || 0), 0)
    const down = onlineNodes.reduce((sum, node) => sum + (node.net_in || 0), 0)
    return { up, down }
  }, [summaryNodes])
  const totalTraffic = useMemo(() => {
    const up = summaryNodes.reduce((sum, node) => sum + (node.net_total_up || 0), 0)
    const down = summaryNodes.reduce((sum, node) => sum + (node.net_total_down || 0), 0)
    return { up, down }
  }, [summaryNodes])
  const totalMemory = useMemo(() => {
    let used = 0
    let total = 0
    for (const node of summaryNodes) {
      used += node.ram || 0
      total += node.mem_total || 0
    }
    return { used, total }
  }, [summaryNodes])
  const totalDisk = useMemo(() => {
    let used = 0
    let total = 0
    for (const node of summaryNodes) {
      used += node.disk || 0
      total += node.disk_total || 0
    }
    return { used, total }
  }, [summaryNodes])

  const formattedTrafficUp = formatBytesSplit(totalTraffic.up, byteDecimals)
  const formattedTrafficDown = formatBytesSplit(totalTraffic.down, byteDecimals)
  const totalTrafficTooltip = formatBytesSplit(totalTraffic.up + totalTraffic.down, byteDecimals)
  const formattedSpeedUp = formatBytesPerSecondSplit(totalSpeed.up, byteDecimals)
  const formattedSpeedDown = formatBytesPerSecondSplit(totalSpeed.down, byteDecimals)
  const formattedMemoryUsed = formatBytesSplit(totalMemory.used, byteDecimals)
  const formattedMemoryTotal = formatBytesSplit(totalMemory.total, byteDecimals)
  const formattedDiskUsed = formatBytesSplit(totalDisk.used, byteDecimals)
  const formattedDiskTotal = formatBytesSplit(totalDisk.total, byteDecimals)

  const targetExchangeRate = exchangeRates[exchangeRateBaseCurrency] || 1
  const remainingValue = financeHelper.calculateTotalRemainingValueCNY(summaryNodes, exchangeRates, excludeFreeNodes) * targetExchangeRate
  const totalValue = financeHelper.calculateTotalValueCNY(summaryNodes, exchangeRates, excludeFreeNodes) * targetExchangeRate
  const monthlyAverageCost = financeHelper.calculateTotalMonthlyAverageCostCNY(summaryNodes, exchangeRates, excludeFreeNodes) * targetExchangeRate
  const formattedRemainingValue = financeHelper.formatFinanceAmount(remainingValue, exchangeRateBaseCurrency)
  const formattedTotalValue = financeHelper.formatFinanceAmount(totalValue, exchangeRateBaseCurrency)
  const formattedMonthlyAverageCost = financeHelper.formatFinanceAmount(monthlyAverageCost, exchangeRateBaseCurrency)
  const financeSummaryItems = [
    { label: '总价值', value: formattedTotalValue.value, symbol: formattedTotalValue.symbol, currency: formattedTotalValue.currency },
    { label: '月均支出', value: formattedMonthlyAverageCost.value, symbol: formattedMonthlyAverageCost.symbol, currency: `${formattedMonthlyAverageCost.currency}/月` },
    { label: '剩余价值', value: formattedRemainingValue.value, symbol: formattedRemainingValue.symbol, currency: formattedRemainingValue.currency },
  ]
  const exchangeRateRows = financeRateCurrencies.map((currency) => {
    const baseRate = exchangeRates[exchangeRateBaseCurrency] || 1
    const targetRate = exchangeRates[currency] || 1
    const rate = targetRate / baseRate
    return {
      currency,
      targetSymbol: financeHelper.CURRENCY_SYMBOLS[currency],
      rate: new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 6, minimumFractionDigits: 6 }).format(rate),
    }
  })

  const showEarth = earthViewMode === 'earth' || earthViewMode === 'earth-stop'
  const showMaps = earthViewMode === 'maps'
  const showVisualPanel = showEarth || showMaps
  const wrapperClass = showVisualPanel
    ? 'relative isolate overflow-x-clip grid h-auto grid-cols-1 gap-2 p-4 lg:h-58 lg:grid-cols-12 lg:grid-rows-1'
    : 'relative isolate overflow-x-clip grid h-auto grid-cols-1 gap-2 p-4'
  const cardGridClass = showVisualPanel
    ? 'relative z-9 col-span-1 grid grid-cols-2 grid-rows-3 gap-2 lg:col-span-6 lg:row-start-1 lg:grid-cols-12 lg:grid-rows-2 lg:h-auto'
    : 'col-span-1 grid grid-cols-2 gap-2 lg:grid-cols-6'
  const financeCardClass = showVisualPanel
    ? 'relative col-span-1 col-start-1 row-start-2 h-full min-w-0 w-full lg:col-span-4 lg:col-start-5 lg:row-start-1'
    : 'relative col-span-1 col-start-1 row-start-2 min-h-20 min-w-0 lg:col-start-3 lg:row-start-1 lg:min-h-28'

  function updateBaseCurrency(value: string) {
    const currency = financeHelper.normalizeCurrency(value)
    setExchangeRateBaseCurrency(currency)
    financeHelper.setStoredFinanceCurrency(currency)
  }

  function closeFinanceCard() {
    setOpenFinanceCard(false)
    financeTriggerRef.current?.focus()
  }

  function toggleFinanceCard() {
    if (openFinanceCard)
      closeFinanceCard()
    else
      setOpenFinanceCard(true)
  }

  function handleFinanceCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && openFinanceCard) {
      event.preventDefault()
      closeFinanceCard()
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ')
      return
    event.preventDefault()
    toggleFinanceCard()
  }

  function handleFinanceDisclosureKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    event.stopPropagation()
    closeFinanceCard()
  }

  return (
    <div className={wrapperClass}>
      {showVisualPanel
        ? (
            <div className="relative isolate col-span-1 h-52 min-h-0 overflow-hidden lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:h-full">
              {showEarth ? <NodeEarthGlobe nodes={globeNodes} spinning={earthViewMode === 'earth'} /> : null}
              {showMaps ? <NodeEarthMaps nodes={globeNodes} className="h-full" /> : null}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-2 h-24 bg-gradient-to-t from-background from-15% to-transparent" aria-hidden="true" />
            </div>
          )
        : null}

      <div className={cardGridClass}>
        <SummaryCard title="内存用量" icon="tabler:cash" value={formattedMemoryUsed.value} unit={`${formattedMemoryUsed.unit} / ${formattedMemoryTotal.value} ${formattedMemoryTotal.unit}`} visual={showVisualPanel} index={0} />
        <SummaryCard title="硬盘用量" icon="tabler:server-2" value={formattedDiskUsed.value} unit={`${formattedDiskUsed.unit} / ${formattedDiskTotal.value} ${formattedDiskTotal.unit}`} visual={showVisualPanel} index={1} />

        <div className={financeCardClass}>
          <CardX
            ref={financeTriggerRef}
            interaction="pressable"
            role="button"
            tabIndex={0}
            aria-label={openFinanceCard ? '收起剩余价值详情' : '展开剩余价值详情'}
            aria-expanded={openFinanceCard}
            aria-controls="finance-disclosure"
            className="motion-stagger-item group h-full min-w-0 rounded-2xl bg-card"
            contentClassName="p-3 xl:p-4"
            style={{ animationDelay: `${2 * 45}ms` }}
            onClick={toggleFinanceCard}
            onKeyDown={handleFinanceCardKeyDown}
          >
            <div className="flex h-full min-w-0 flex-col justify-between gap-1">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">剩余价值</span>
                <span className="flex items-center gap-0.5">
                  <Icon icon="tabler:cash" width={20} height={20} className="text-muted-foreground/40 transition-colors group-hover:text-foreground/70" aria-hidden="true" />
                  <Icon icon="tabler:chevron-down" width={16} height={16} className={`text-muted-foreground transition-transform duration-200 ${openFinanceCard ? 'rotate-180' : ''}`} aria-hidden="true" />
                </span>
              </div>
              <div key={`remaining-${transitionKey}`} className="flex min-w-0 flex-col gap-0.5 xl:flex-row xl:items-baseline xl:gap-1">
                <span className="vercel-number text-xl leading-none font-semibold tracking-tight xl:text-2xl">
                  {formattedRemainingValue.symbol}
                  {formattedRemainingValue.value}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground xl:text-xs">{formattedRemainingValue.currency}</span>
              </div>
            </div>
          </CardX>
          <CardX
            interaction="subtle"
            id="finance-disclosure"
            inert={!openFinanceCard}
            aria-hidden={!openFinanceCard}
            className={`absolute top-0 left-0 z-50 h-42 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] translate-x-0 rounded-2xl bg-popover shadow-lg/5 transition-[opacity,transform,background-color,border-color,box-shadow] duration-200 ease-out lg:left-1/2 lg:w-[260%] lg:max-w-88 lg:-translate-x-[50%] ${openFinanceCard ? 'scale-100 opacity-100 lg:-translate-y-[5%]' : 'pointer-events-none scale-50 opacity-0 lg:-translate-y-[25%]'}`}
            contentClassName="h-full p-4"
            onClick={closeFinanceCard}
            onKeyDown={handleFinanceDisclosureKeyDown}
          >
            <div className="flex h-full min-w-0 flex-col">
              <div className="grid shrink-0 grid-cols-3 gap-1.5">
                {financeSummaryItems.map(item => (
                  <div key={item.label} className="min-w-0">
                    <div className="mb-1.5 flex items-center text-xs font-medium text-muted-foreground">{item.label}</div>
                    <div className="flex min-w-0 items-baseline truncate">
                      <span className="mr-0.5 shrink-0 text-xs leading-none font-semibold text-muted-foreground">{item.symbol}</span>
                      <span className="vercel-number text-sm leading-none font-semibold tracking-tight md:text-lg">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex min-h-0 flex-1 flex-col">
                <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs font-medium tracking-wider text-muted-foreground">今日汇率</div>
                  <div className="relative shrink-0">
                    <select
                      value={exchangeRateBaseCurrency}
                      tabIndex={openFinanceCard ? 0 : -1}
                      className="h-7 min-w-18 appearance-none rounded-lg border border-input bg-popover py-1 pr-7 pl-2.5 text-xs font-medium text-muted-foreground shadow-xs/5 outline-none transition-[border-color,color,box-shadow] not-dark:bg-clip-padding hover:bg-accent/50 hover:text-foreground focus-visible:border-ring focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/24 focus-visible:ring-inset dark:bg-input/32 dark:hover:bg-input/64"
                      aria-label="切换汇率基准币种"
                      onClick={event => event.stopPropagation()}
                      onChange={event => updateBaseCurrency(event.target.value)}
                    >
                      {financeRateCurrencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
                    <Icon
                      icon="tabler:chevron-down"
                      width={14}
                      height={14}
                      className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </div>
                <div
                  role="region"
                  aria-label="今日汇率列表"
                  tabIndex={openFinanceCard ? 0 : -1}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                  onClick={event => event.stopPropagation()}
                >
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {exchangeRateRows.map(row => (
                      <div key={row.currency} className="flex items-center text-[11px]">
                        <div className="flex flex-1 justify-between">
                          <span className="text-muted-foreground">{row.currency}</span>
                          <span>
                            {row.targetSymbol}
                            {row.rate}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardX>
        </div>

        <SummaryCard
          title="累计流量"
          icon="tabler:download"
          value={totalTrafficTooltip.value}
          unit={totalTrafficTooltip.unit}
          visual={showVisualPanel}
          index={3}
          tooltip={`↑ ${formattedTrafficUp.value} ${formattedTrafficUp.unit}\n↓ ${formattedTrafficDown.value} ${formattedTrafficDown.unit}`}
        />
        <SummaryCard title="实时上行" icon="tabler:chevrons-up" value={formattedSpeedUp.value} unit={formattedSpeedUp.unit} visual={showVisualPanel} index={4} />
        <SummaryCard title="实时下行" icon="tabler:chevrons-down" value={formattedSpeedDown.value} unit={formattedSpeedDown.unit} visual={showVisualPanel} index={5} />
      </div>
    </div>
  )
}

function SummaryCard({ title, icon, value, unit, visual, index, tooltip }: { title: string, icon: string, value: string, unit: string, visual: boolean, index: number, tooltip?: string }) {
  const positions = visual
    ? [
        'col-span-1 col-start-1 row-start-1 min-w-0 lg:col-span-4 lg:col-start-1 lg:row-start-1',
        'col-span-1 col-start-2 row-start-1 min-w-0 lg:col-span-4 lg:col-start-1 lg:row-start-2',
        'col-span-1 col-start-1 row-start-2 min-w-0 lg:col-span-4 lg:col-start-5 lg:row-start-1',
        'col-span-1 col-start-2 row-start-2 min-w-0 lg:col-span-4 lg:col-start-5 lg:row-start-2',
        'col-span-1 col-start-1 row-start-3 min-w-0 lg:col-span-4 lg:col-start-9 lg:row-start-1',
        'col-span-1 col-start-2 row-start-3 min-w-0 lg:col-span-4 lg:col-start-9 lg:row-start-2',
      ]
    : [
        'col-span-1 col-start-1 row-start-1 min-h-20 min-w-0 lg:col-start-1 lg:row-start-1 lg:min-h-28',
        'col-span-1 col-start-2 row-start-1 min-h-20 min-w-0 lg:col-start-2 lg:row-start-1 lg:min-h-28',
        'col-span-1 col-start-1 row-start-2 min-h-20 min-w-0 lg:col-start-3 lg:row-start-1 lg:min-h-28',
        'col-span-1 col-start-2 row-start-2 min-h-20 min-w-0 lg:col-start-4 lg:row-start-1 lg:min-h-28',
        'col-span-1 col-start-1 row-start-3 min-h-20 min-w-0 lg:col-start-5 lg:row-start-1 lg:min-h-28',
        'col-span-1 col-start-2 row-start-3 min-h-20 min-w-0 lg:col-start-6 lg:row-start-1 lg:min-h-28',
      ]

  const content = (
    <div className="flex h-full min-w-0 flex-col justify-between gap-1">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium tracking-wider text-muted-foreground">{title}</span>
        <Icon icon={icon} width={20} height={20} className="text-muted-foreground/40 transition-colors group-hover:text-foreground/70" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 xl:flex-row xl:items-baseline xl:gap-1">
        <span className="vercel-number text-xl leading-none font-semibold tracking-tight xl:text-2xl">{value}</span>
        <span className="text-[11px] font-medium text-muted-foreground xl:text-xs">{unit}</span>
      </div>
    </div>
  )

  return (
    <CardX interaction="subtle" className={`motion-stagger-item group h-full min-w-0 rounded-2xl bg-card ${positions[index]}`} contentClassName="p-3 xl:p-4" style={{ animationDelay: `${index * 45}ms` }}>
      {tooltip
        ? (
            <DataTooltip as="span" placement="top" content={tooltip} className="min-w-0" contentClass="whitespace-pre px-2 py-1 left-0 -translate-x-0 leading-normal">
              {content}
            </DataTooltip>
          )
        : content}
    </CardX>
  )
}
