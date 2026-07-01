"use client";

import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NodeEarthGlobe } from "@/components/node/NodeEarthGlobe";
import { useAppStore } from "@/stores/app";
import { useNodesStore, type NodeData } from "@/stores/nodes";
import * as financeHelper from "@/utils/financeHelper";
import type { CurrencyCode } from "@/utils/financeHelper";
import { formatBytesPerSecondSplit, formatBytesSplit } from "@/utils/helper";

const NodeEarthMaps = dynamic(
  () => import("@/components/node/NodeEarthMaps").then((m) => m.NodeEarthMaps),
  { ssr: false },
);

interface NodeGeneralCardsProps {
  nodes?: NodeData[];
  globeNodes?: NodeData[];
  transitionKey?: string;
}

export function NodeGeneralCards({ nodes, globeNodes, transitionKey }: NodeGeneralCardsProps) {
  const byteDecimals = useAppStore((s) => s.byteDecimals);
  const earthViewMode = useAppStore((s) => s.getEarthViewMode());
  const disablePageAnimation = useAppStore((s) => s.getDisablePageAnimation());
  const allNodes = useNodesStore((s) => s.nodes);
  const summaryNodes = nodes ?? allNodes;
  const summaryTransitionKey = transitionKey ?? "all";

  const [exchangeRates, setExchangeRates] = useState(financeHelper.DEFAULT_EXCHANGE_RATES);
  const [exchangeRateBaseCurrency, setExchangeRateBaseCurrency] = useState<CurrencyCode>("CNY");
  const [excludeFreeNodes] = useState(true);
  const financeRateCurrencies: readonly CurrencyCode[] = financeHelper.DISPLAY_FINANCE_CURRENCIES;
  const [openFinanceCard, setOpenFinanceCard] = useState(false);

  useEffect(() => {
    setExchangeRateBaseCurrency(financeHelper.getStoredFinanceCurrency());
    financeHelper.getDailyExchangeRates().then(({ rates }) => setExchangeRates(rates));
  }, []);

  const totalSpeed = useMemo(() => {
    const onlineNodes = summaryNodes.filter((n) => n.online);
    return {
      up: onlineNodes.reduce((s, n) => s + (n.net_out || 0), 0),
      down: onlineNodes.reduce((s, n) => s + (n.net_in || 0), 0),
    };
  }, [summaryNodes]);

  const totalTraffic = useMemo(() => {
    return {
      up: summaryNodes.reduce((s, n) => s + (n.net_total_up || 0), 0),
      down: summaryNodes.reduce((s, n) => s + (n.net_total_down || 0), 0),
    };
  }, [summaryNodes]);

  const formattedTrafficUp = useMemo(
    () => formatBytesSplit(totalTraffic.up, byteDecimals),
    [totalTraffic.up, byteDecimals],
  );
  const formattedTrafficDown = useMemo(
    () => formatBytesSplit(totalTraffic.down, byteDecimals),
    [totalTraffic.down, byteDecimals],
  );
  const totalTrafficTooltip = useMemo(
    () => formatBytesSplit(totalTraffic.up + totalTraffic.down, byteDecimals),
    [totalTraffic.up, totalTraffic.down, byteDecimals],
  );
  const formattedSpeedUp = useMemo(
    () => formatBytesPerSecondSplit(totalSpeed.up, byteDecimals),
    [totalSpeed.up, byteDecimals],
  );
  const formattedSpeedDown = useMemo(
    () => formatBytesPerSecondSplit(totalSpeed.down, byteDecimals),
    [totalSpeed.down, byteDecimals],
  );

  const totalMemory = useMemo(() => {
    let used = 0;
    let total = 0;
    for (const node of summaryNodes) {
      used += node.ram || 0;
      total += node.mem_total || 0;
    }
    return { used, total };
  }, [summaryNodes]);

  const totalDisk = useMemo(() => {
    let used = 0;
    let total = 0;
    for (const node of summaryNodes) {
      used += node.disk || 0;
      total += node.disk_total || 0;
    }
    return { used, total };
  }, [summaryNodes]);

  const formattedMemoryUsed = useMemo(
    () => formatBytesSplit(totalMemory.used, byteDecimals),
    [totalMemory.used, byteDecimals],
  );
  const formattedMemoryTotal = useMemo(
    () => formatBytesSplit(totalMemory.total, byteDecimals),
    [totalMemory.total, byteDecimals],
  );
  const formattedDiskUsed = useMemo(
    () => formatBytesSplit(totalDisk.used, byteDecimals),
    [totalDisk.used, byteDecimals],
  );
  const formattedDiskTotal = useMemo(
    () => formatBytesSplit(totalDisk.total, byteDecimals),
    [totalDisk.total, byteDecimals],
  );

  const remainingValueCNY = useMemo(
    () => financeHelper.calculateTotalRemainingValueCNY(summaryNodes, exchangeRates, excludeFreeNodes),
    [summaryNodes, exchangeRates, excludeFreeNodes],
  );
  const totalValueCNY = useMemo(
    () => financeHelper.calculateTotalValueCNY(summaryNodes, exchangeRates, excludeFreeNodes),
    [summaryNodes, exchangeRates, excludeFreeNodes],
  );
  const monthlyAverageCostCNY = useMemo(
    () => financeHelper.calculateTotalMonthlyAverageCostCNY(summaryNodes, exchangeRates, excludeFreeNodes),
    [summaryNodes, exchangeRates, excludeFreeNodes],
  );
  const targetExchangeRate = exchangeRates[exchangeRateBaseCurrency] || 1;
  const formattedRemainingValue = useMemo(
    () => financeHelper.formatFinanceAmount(remainingValueCNY * targetExchangeRate, exchangeRateBaseCurrency),
    [remainingValueCNY, targetExchangeRate, exchangeRateBaseCurrency],
  );
  const formattedTotalValue = useMemo(
    () => financeHelper.formatFinanceAmount(totalValueCNY * targetExchangeRate, exchangeRateBaseCurrency),
    [totalValueCNY, targetExchangeRate, exchangeRateBaseCurrency],
  );
  const formattedMonthlyAverageCost = useMemo(
    () => financeHelper.formatFinanceAmount(monthlyAverageCostCNY * targetExchangeRate, exchangeRateBaseCurrency),
    [monthlyAverageCostCNY, targetExchangeRate, exchangeRateBaseCurrency],
  );

  const exchangeRateRows = useMemo(
    () =>
      financeRateCurrencies.map((currency) => {
        const baseRate = exchangeRates[exchangeRateBaseCurrency] || 1;
        const targetRate = exchangeRates[currency] || 1;
        const rate = targetRate / baseRate;
        return {
          currency,
          targetSymbol: financeHelper.CURRENCY_SYMBOLS[currency],
          rate: new Intl.NumberFormat("zh-CN", {
            maximumFractionDigits: 6,
            minimumFractionDigits: 6,
          }).format(rate),
        };
      }),
    [financeRateCurrencies, exchangeRates, exchangeRateBaseCurrency],
  );

  const showEarth = earthViewMode === "earth" || earthViewMode === "earth-stop";
  const showMaps = earthViewMode === "maps";
  const showVisualPanel = showEarth || showMaps;

  const wrapperClass = showVisualPanel
    ? "p-4 grid grid-cols-12 grid-rows-1 gap-2 h-auto md:h-58"
    : "p-4 grid grid-cols-1 gap-2 h-auto";
  const cardGridClass = showVisualPanel
    ? "h-42 -mt-42 md:mt-0 col-span-12 row-start-3 z-9 md:h-auto md:col-span-6 md:row-start-1 grid grid-cols-12 grid-rows-2 gap-2"
    : "col-span-1 grid grid-cols-3 md:grid-cols-6 gap-2";

  function getMetricSwitchStyle(index: number): React.CSSProperties {
    return { ["--metric-switch-delay" as string]: `${index * 35}ms` } as React.CSSProperties;
  }

  return (
    <div className={wrapperClass}>
      {showEarth && (
        <NodeEarthGlobe
          nodes={globeNodes ?? summaryNodes}
          className="col-span-12 col-start-1 md:col-span-6 md:col-start-7"
        />
      )}
      {showMaps && (
        <NodeEarthMaps
          nodes={globeNodes ?? summaryNodes}
          className="col-span-12 col-start-1 md:col-span-6 md:col-start-7"
        />
      )}

      <div className={cardGridClass}>
        {/* Memory card */}
        <Card
         
          className={`group h-full bg-background/50 border-none hover:bg-background backdrop-blur-xs transition-all ${
            showVisualPanel ? "col-span-4 row-span-1 col-start-1 row-start-1" : "col-span-1 row-start-1 col-start-1 min-h-18 md:min-h-28 md:row-start-1 md:col-start-1"
          }`}
        >
          <CardContent className="h-full !p-3">
            <div className="flex h-full flex-col justify-between gap-1">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">内存用量</span>
                <Icon icon="tabler:cash" width={20} height={20} className="text-slate-500/20 group-hover:text-slate-500 transition-colors" />
              </div>
              <div key={`memory-${summaryTransitionKey}`} className="flex items-baseline gap-1 min-w-0" style={getMetricSwitchStyle(0)}>
                <span className="text-md md:text-2xl font-bold leading-none tracking-tight">
                  {formattedMemoryUsed.value}
                </span>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground truncate">
                  {formattedMemoryUsed.unit} / {formattedMemoryTotal.value} {formattedMemoryTotal.unit}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disk card */}
        <Card
         
          className={`group h-full bg-background/50 border-none hover:bg-background backdrop-blur-xs transition-all ${
            showVisualPanel ? "col-span-4 row-span-1 col-start-1 row-start-2" : "col-span-1 row-start-2 col-start-1 min-h-18 md:min-h-28 md:row-start-1 md:col-start-2"
          }`}
        >
          <CardContent className="h-full !p-3">
            <div className="flex h-full flex-col justify-between gap-1">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">硬盘用量</span>
                <Icon icon="tabler:server-2" width={20} height={20} className="text-slate-500/20 group-hover:text-slate-500 transition-colors" />
              </div>
              <div key={`disk-${summaryTransitionKey}`} className="flex items-baseline gap-1 min-w-0" style={getMetricSwitchStyle(1)}>
                <span className="text-md md:text-2xl font-bold leading-none tracking-tight">{formattedDiskUsed.value}</span>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground truncate">
                  {formattedDiskUsed.unit} / {formattedDiskTotal.value} {formattedDiskTotal.unit}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remaining value card */}
        <div
          className={`relative w-full h-full ${
            showVisualPanel ? "col-span-4 row-span-1 col-start-5 row-start-1" : "col-span-1 row-start-1 col-start-2 min-h-18 md:min-h-28 md:row-start-1 md:col-start-3"
          }`}
        >
          <Card
           
            className="group h-full bg-background/50 border-none hover:bg-background backdrop-blur-xs transition-all cursor-pointer"
            onClick={() => setOpenFinanceCard((v) => !v)}
          >
            <CardContent className="h-full !p-3">
              <div className="flex h-full flex-col justify-between gap-1">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium tracking-wider text-muted-foreground">剩余价值</span>
                  <Icon icon="tabler:cash" width={20} height={20} className="text-slate-500/20 group-hover:text-slate-500 transition-colors" />
                </div>
                <div key={`remaining-value-${summaryTransitionKey}`} className="flex items-baseline gap-1 min-w-0" style={getMetricSwitchStyle(2)}>
                  <span className="text-md md:text-2xl font-bold leading-none tracking-tight">
                    {formattedRemainingValue.symbol}{formattedRemainingValue.value}
                  </span>
                  <span className="block truncate text-[11px] md:text-xs font-medium text-muted-foreground">
                    {formattedRemainingValue.currency}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
           
            className={`absolute top-0 left-1/2 -translate-x-[50%] -translate-y-[25%] z-20 w-[260%] max-w-88 h-42 group bg-background/50 rounded-lg shadow-xl border-none backdrop-blur-lg transition-all ${
              openFinanceCard
                ? "opacity-100 scale-100 -translate-y-[5%]"
                : "opacity-0 pointer-events-none scale-50"
            }`}
          >
            <CardContent className="h-full !p-4" onClick={() => setOpenFinanceCard(false)}>
              <div className="flex h-full min-w-0 flex-col overflow-hidden">
                <div className="shrink-0 grid grid-cols-3 gap-1.5">
                  {[
                    { label: "总价值", icon: "tabler:wallet", value: formattedTotalValue.value, symbol: formattedTotalValue.symbol, currency: formattedTotalValue.currency },
                    { label: "月均支出", icon: "tabler:receipt-2", value: formattedMonthlyAverageCost.value, symbol: formattedMonthlyAverageCost.symbol, currency: `${formattedMonthlyAverageCost.currency}/月` },
                    { label: "剩余价值", icon: "tabler:coins", value: formattedRemainingValue.value, symbol: formattedRemainingValue.symbol, currency: formattedRemainingValue.currency },
                  ].map((item, index) => (
                    <div key={item.label} className="min-w-0">
                      <div className="flex mb-1.5 items-center text-xs font-medium text-muted-foreground">{item.label}</div>
                      <div key={`remaining-value-${summaryTransitionKey}-${exchangeRateBaseCurrency}-${openFinanceCard}`} className="flex min-w-0 items-baseline truncate" style={getMetricSwitchStyle(index)}>
                        <span className="shrink-0 text-xs mr-0.5 font-semibold leading-none text-muted-foreground">{item.symbol}</span>
                        <span className="text-sm md:text-lg font-bold leading-none tracking-tight">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex-1" />
                <div className="shrink-0 flex flex-col flex-1">
                  <div className="flex mb-1 items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs font-medium tracking-wider text-muted-foreground">
                      今日汇率
                    </div>
                    <select
                      value={exchangeRateBaseCurrency}
                      className="shrink-0 rounded-sm border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus:text-foreground"
                      aria-label="切换汇率基准币种"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        const next = financeHelper.normalizeCurrency(e.target.value);
                        setExchangeRateBaseCurrency(next);
                        financeHelper.setStoredFinanceCurrency(next);
                      }}
                    >
                      {financeRateCurrencies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1" />
                  <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                    {exchangeRateRows.map((row, index) => (
                      <div key={row.currency} className="text-[11px] flex items-center">
                        <div key={`remaining-value-${exchangeRateBaseCurrency}-${openFinanceCard}`} className="flex-1 flex justify-between" style={getMetricSwitchStyle(index)}>
                          <span className="text-muted-foreground">{row.currency}</span>
                          <span>{row.targetSymbol}{row.rate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Traffic card */}
        <Card
         
          className={`group bg-background/50 border-none hover:bg-background backdrop-blur-xs transition-all ${
            showVisualPanel ? "col-span-4 row-span-1 col-start-5 row-start-2" : "col-span-1 row-start-2 col-start-2 min-h-18 md:min-h-28 md:row-start-1 md:col-start-4"
          }`}
        >
          <CardContent className="h-full !p-3">
            <div className="flex h-full flex-col justify-between gap-1">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">累计流量</span>
                <Icon icon="tabler:download" width={20} height={20} className="text-slate-500/20 group-hover:text-slate-500 transition-colors" />
              </div>
              <Tooltip>
                <TooltipTrigger>
                  <div key={`traffic-${summaryTransitionKey}`} className="flex items-baseline gap-1" style={getMetricSwitchStyle(3)}>
                    <span className="inline-block text-md md:text-2xl font-bold leading-none tracking-tight">
                      {totalTrafficTooltip.value}
                    </span>
                    <span className="inline-block text-[11px] md:text-xs font-medium text-muted-foreground">
                      {totalTrafficTooltip.unit}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="whitespace-pre px-2 py-1 leading-normal">
                  ↑ {formattedTrafficUp.value} {formattedTrafficUp.unit}
                  ↓ {formattedTrafficDown.value} {formattedTrafficDown.unit}
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>

        {/* Up speed card */}
        <Card
         
          className={`group bg-background/50 border-none hover:bg-background backdrop-blur-xs transition-all ${
            showVisualPanel ? "col-span-4 row-span-1 col-start-9 row-start-1" : "col-span-1 row-start-1 col-start-3 min-h-18 md:min-h-28 md:row-start-1 md:col-start-5"
          }`}
        >
          <CardContent className="h-full !p-3">
            <div className="flex h-full flex-col justify-between gap-1">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">实时上行</span>
                <Icon icon="tabler:chevrons-up" width={20} height={20} className="text-slate-500/20 group-hover:text-slate-500 transition-colors" />
              </div>
              <div key={`speed-up-${summaryTransitionKey}`} className="flex items-baseline gap-1" style={getMetricSwitchStyle(4)}>
                <span className="text-md md:text-2xl font-bold leading-none tracking-tight">{formattedSpeedUp.value}</span>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{formattedSpeedUp.unit}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Down speed card */}
        <Card
         
          className={`group bg-background/50 border-none hover:bg-background backdrop-blur-xs transition-all ${
            showVisualPanel ? "col-span-4 row-span-1 col-start-9 row-start-2" : "col-span-1 row-start-2 col-start-3 min-h-18 md:min-h-28 md:row-start-1 md:col-start-6"
          }`}
        >
          <CardContent className="h-full !p-3">
            <div className="flex h-full flex-col justify-between gap-1">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">实时下行</span>
                <Icon icon="tabler:chevrons-down" width={20} height={20} className="text-slate-500/20 group-hover:text-slate-500 transition-colors" />
              </div>
              <div key={`speed-down-${summaryTransitionKey}`} className="flex items-baseline gap-1" style={getMetricSwitchStyle(5)}>
                <span className="text-md md:text-2xl font-bold leading-none tracking-tight">{formattedSpeedDown.value}</span>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{formattedSpeedDown.unit}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default NodeGeneralCards;