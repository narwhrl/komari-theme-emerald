'use client'

import type { KeyboardEvent } from 'react'
import type { NodeData } from '@/stores/nodes'
import type { CurrencyCode } from '@/utils/financeHelper'
import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'
import NodeEarthGlobe from '@/components/NodeEarthGlobe'
import NodeEarthMaps from '@/components/NodeEarthMaps'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/tooltip'
import { useAppDerived, useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondSplit, formatBytesSplit } from '@/utils/helper'

const financeRateCurrencies: readonly CurrencyCode[] = financeHelper.DISPLAY_FINANCE_CURRENCIES

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
    ? 'grid h-auto grid-cols-12 grid-rows-1 gap-2 p-4 md:h-58'
    : 'grid h-auto grid-cols-1 gap-2 p-4'
  const cardGridClass = showVisualPanel
    ? 'z-9 col-span-12 row-start-3 -mt-42 grid h-42 grid-cols-12 grid-rows-2 gap-2 md:col-span-6 md:row-start-1 md:mt-0 md:h-auto'
    : 'col-span-1 grid grid-cols-3 gap-2 md:grid-cols-6'

  function updateBaseCurrency(value: string) {
    const currency = financeHelper.normalizeCurrency(value)
    setExchangeRateBaseCurrency(currency)
    financeHelper.setStoredFinanceCurrency(currency)
  }

  function toggleFinanceCard() {
    setOpenFinanceCard(value => !value)
  }

  function handleFinanceCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ')
      return
    event.preventDefault()
    toggleFinanceCard()
  }

  return (
    <div className={wrapperClass}>
      {showEarth ? <NodeEarthGlobe nodes={globeNodes} spinning={earthViewMode === 'earth'} className="col-span-12 col-start-1 md:col-span-6 md:col-start-7" /> : null}
      {showMaps ? <NodeEarthMaps nodes={globeNodes} className="col-span-12 col-start-1 md:col-span-6 md:col-start-7" /> : null}

      <div className={cardGridClass}>
        <SummaryCard title="内存用量" icon="tabler:cash" value={formattedMemoryUsed.value} unit={`${formattedMemoryUsed.unit} / ${formattedMemoryTotal.value} ${formattedMemoryTotal.unit}`} visual={showVisualPanel} index={0} />
        <SummaryCard title="硬盘用量" icon="tabler:server-2" value={formattedDiskUsed.value} unit={`${formattedDiskUsed.unit} / ${formattedDiskTotal.value} ${formattedDiskTotal.unit}`} visual={showVisualPanel} index={1} />

        <div className={showVisualPanel ? 'relative col-span-4 row-span-1 col-start-5 row-start-1 h-full w-full' : 'relative col-span-1 col-start-2 row-start-1 min-h-18 md:col-start-3 md:row-start-1 md:min-h-28'}>
          <CardX
            interaction="pressable"
            role="button"
            tabIndex={0}
            aria-label="展开剩余价值详情"
            aria-expanded={openFinanceCard}
            className="motion-stagger-item group h-full rounded-2xl bg-card"
            style={{ animationDelay: `${2 * 45}ms` }}
            onClick={toggleFinanceCard}
            onKeyDown={handleFinanceCardKeyDown}
          >
            <div className="flex h-full min-w-0 flex-col justify-between gap-1">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">剩余价值</span>
                <Icon icon="tabler:cash" width={20} height={20} className="text-muted-foreground/40 transition-colors group-hover:text-foreground/70" />
              </div>
              <div key={`remaining-${transitionKey}`} className="flex min-w-0 items-baseline gap-1">
                <span className="vercel-number text-md leading-none font-semibold tracking-tight md:text-2xl">
                  {formattedRemainingValue.symbol}
                  {formattedRemainingValue.value}
                </span>
                <span className="block truncate text-[11px] font-medium text-muted-foreground md:text-xs">{formattedRemainingValue.currency}</span>
              </div>
            </div>
          </CardX>
          <CardX
            interaction="subtle"
            className={`absolute top-0 left-1/2 z-50 h-42 w-[260%] max-w-88 -translate-x-[50%] -translate-y-[25%] rounded-2xl bg-popover shadow-lg/5 transition-[opacity,transform,background-color,border-color,box-shadow] duration-200 ease-out ${openFinanceCard ? 'scale-100 opacity-100 -translate-y-[5%]' : 'pointer-events-none scale-50 opacity-0'}`}
            contentClassName="h-full p-4"
            onClick={() => setOpenFinanceCard(false)}
          >
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
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
              <div className="flex-1" />
              <div className="flex shrink-0 flex-1 flex-col">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs font-medium tracking-wider text-muted-foreground">今日汇率</div>
                  <div className="relative shrink-0">
                    <select
                      value={exchangeRateBaseCurrency}
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
                <div className="flex-1" />
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
        'col-span-4 row-span-1 col-start-1 row-start-1',
        'col-span-4 row-span-1 col-start-1 row-start-2',
        'col-span-4 row-span-1 col-start-5 row-start-1',
        'col-span-4 row-span-1 col-start-5 row-start-2',
        'col-span-4 row-span-1 col-start-9 row-start-1',
        'col-span-4 row-span-1 col-start-9 row-start-2',
      ]
    : [
        'col-span-1 col-start-1 row-start-1 min-h-18 md:col-start-1 md:row-start-1 md:min-h-28',
        'col-span-1 col-start-1 row-start-2 min-h-18 md:col-start-2 md:row-start-1 md:min-h-28',
        'col-span-1 col-start-2 row-start-1 min-h-18 md:col-start-3 md:row-start-1 md:min-h-28',
        'col-span-1 col-start-2 row-start-2 min-h-18 md:col-start-4 md:row-start-1 md:min-h-28',
        'col-span-1 col-start-3 row-start-1 min-h-18 md:col-start-5 md:row-start-1 md:min-h-28',
        'col-span-1 col-start-3 row-start-2 min-h-18 md:col-start-6 md:row-start-1 md:min-h-28',
      ]

  const content = (
    <div className="flex h-full min-w-0 flex-col justify-between gap-1">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium tracking-wider text-muted-foreground">{title}</span>
        <Icon icon={icon} width={20} height={20} className="text-muted-foreground/40 transition-colors group-hover:text-foreground/70" />
      </div>
      <div className="flex min-w-0 items-baseline gap-1">
        <span className="vercel-number text-md leading-none font-semibold tracking-tight md:text-2xl">{value}</span>
        <span className="truncate text-[11px] font-medium text-muted-foreground md:text-xs">{unit}</span>
      </div>
    </div>
  )

  return (
    <CardX interaction="subtle" className={`motion-stagger-item group h-full rounded-2xl bg-card ${positions[index]}`} style={{ animationDelay: `${index * 45}ms` }}>
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
