/**
 * Instance detail page (Next.js App Router) — equivalent to
 * `views/InstanceDetail.vue`. Fully aligned with the original Vue view:
 * 4 finance metric cards (price / monthly cost / remaining time / remaining
 * value), plus a Network info card showing total traffic and live rate.
 */
"use client";

import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/EmptyCompat";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useAppStore } from "@/stores/app";
import { useNodesStore } from "@/stores/nodes";
import { formatUptimeWithFormat, formatBytesWithConfig, formatBytesPerSecondWithConfig, formatDateTime } from "@/utils/helper";
import { getOSImage, getOSName } from "@/utils/osImageHelper";
import { getRegionCode, getRegionDisplayName } from "@/utils/regionHelper";
import * as financeHelper from "@/utils/financeHelper";
import type { CurrencyCode, ExchangeRates } from "@/utils/financeHelper";
import { getBillingCycleText, getExpireText, getExpireTextClass } from "@/utils/tagHelper";

const LoadChart = dynamic(
  () => import("@/components/charts/LoadChart").then((m) => m.LoadChart),
  { ssr: false },
);
const PingChart = dynamic(
  () => import("@/components/charts/PingChart").then((m) => m.PingChart),
  { ssr: false },
);

interface InfoItem {
  label: string;
  value: string | undefined;
  icon?: string;
}

interface MetricCard {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  valueClass?: string;
}

const EXPIRES_IN_SUFFIX_REGEX = /^(\d+)\s*(天|days?)$/i;
const CURRENCY_SUFFIX_REGEX = /^(\S.*\S)\s+([A-Z]{3})$/;

function splitMetricValue(value: string): { value: string; unit?: string } {
  const cycleIndex = value.indexOf(" / ");
  if (cycleIndex > -1) {
    return {
      value: value.slice(0, cycleIndex),
      unit: value.slice(cycleIndex),
    };
  }
  const expiresInMatch = value.match(EXPIRES_IN_SUFFIX_REGEX);
  if (expiresInMatch) {
    return {
      value: expiresInMatch[1] ?? value,
      unit: expiresInMatch[2] ?? undefined,
    };
  }
  const currencyMatch = value.match(CURRENCY_SUFFIX_REGEX);
  if (currencyMatch) {
    return {
      value: currencyMatch[1] ?? value,
      unit: currencyMatch[2] ?? undefined,
    };
  }
  return { value };
}

/**
 * Format a CNY-denominated amount in the user's preferred currency.
 * Pure function — safe to call inside useMemo.
 */
function formatFinanceMetricValue(
  amountCNY: number,
  currency: CurrencyCode,
  exchangeRates: ExchangeRates,
): string {
  const targetRate = exchangeRates[currency] || 1;
  const formatted = financeHelper.formatFinanceAmount(
    amountCNY * targetRate,
    currency,
  );
  return `${formatted.symbol}${formatted.value} ${formatted.currency}`;
}

export default function InstanceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const lang = useAppStore((s) => s.lang);
  const byteDecimals = useAppStore((s) => s.byteDecimals);
  const data = useNodesStore((s) =>
    s.nodes.find((n) => n.uuid === params.id),
  );

  // React state — NOT a module-level let. The original implementation used
  // a module-level proxy that broke the render cycle (changes never
  // triggered re-renders). State is the React-idiomatic fix.
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(
    financeHelper.DEFAULT_EXCHANGE_RATES,
  );
  const [financeBaseCurrency, setFinanceBaseCurrency] = useState<CurrencyCode>(
    "CNY",
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setFinanceBaseCurrency(financeHelper.getStoredFinanceCurrency());
    (async () => {
      const { rates } = await financeHelper.getDailyExchangeRates();
      setExchangeRates(rates);
    })();
  }, []);

  // Format helpers — identity functions, no need to memoize.
  const formatBytes = (bytes: number) =>
    formatBytesWithConfig(bytes, byteDecimals);
  const formatBytesPerSecond = (bytes: number) =>
    formatBytesPerSecondWithConfig(bytes, byteDecimals);
  const formatUptime = (seconds: number) =>
    formatUptimeWithFormat(seconds, "minute");

  // Memoize all 4 metric strings. Each depends on `data`, `exchangeRates`,
  // `financeBaseCurrency`, `lang`. Without useMemo they recompute on every
  // keystroke or scroll event in unrelated state.
  const { nodePriceText, monthlyAverageCostText, remainingTimeText, remainingValueText } =
    useMemo(() => {
      if (!data) {
        return {
          nodePriceText: "-",
          monthlyAverageCostText: "-",
          remainingTimeText: "-",
          remainingValueText: "-",
        };
      }
      const priceCNY = financeHelper.calculateValueCNY(data, exchangeRates);
      const nodePriceText =
        priceCNY <= 0
          ? formatFinanceMetricValue(0, financeBaseCurrency, exchangeRates)
          : `${formatFinanceMetricValue(priceCNY, financeBaseCurrency, exchangeRates)} / ${getBillingCycleText(data.billing_cycle, lang)}`;

      const monthlyAverageCostText =
        Number(data.billing_cycle) <= 0
          ? lang === "zh-CN"
            ? "不适用"
            : "N/A"
          : `${formatFinanceMetricValue(financeHelper.calculateMonthlyAverageCostCNY(data, exchangeRates), financeBaseCurrency, exchangeRates)} / 月`;

      const remainingTimeText = data.expired_at
        ? getExpireText(data.expired_at, lang)
        : "-";

      const remainingValueCNY = financeHelper.calculateRemainingValueCNY(
        data,
        exchangeRates,
      );
      const remainingValueText = formatFinanceMetricValue(
        remainingValueCNY,
        financeBaseCurrency,
        exchangeRates,
      );

      return {
        nodePriceText,
        monthlyAverageCostText,
        remainingTimeText,
        remainingValueText,
      };
    }, [data, exchangeRates, financeBaseCurrency, lang]);

  const remainingTimeValueClass = data?.expired_at
    ? getExpireTextClass(data.expired_at)
    : "";

  // Memoize metric cards to avoid recomputing splitMetricValue on every render.
  // Previously each card called splitMetricValue twice, leading to ~8 regex
  // matches per render for the 4-card array.
  const metricCards: MetricCard[] = useMemo(() => {
    if (!data) return [];
    return [
      (() => {
        const v = splitMetricValue(nodePriceText);
        return {
          label: "节点价格",
          value: v.value,
          unit: v.unit,
          icon: "tabler:cash",
        };
      })(),
      (() => {
        const v = splitMetricValue(monthlyAverageCostText);
        return {
          label: "月均支出",
          value: v.value,
          unit: v.unit,
          icon: "tabler:receipt-2",
        };
      })(),
      (() => {
        const v = splitMetricValue(remainingTimeText);
        return {
          label: "剩余时间",
          value: v.value,
          unit: v.unit,
          icon: "tabler:calendar-dollar",
          valueClass: remainingTimeValueClass,
        };
      })(),
      (() => {
        const v = splitMetricValue(remainingValueText);
        return {
          label: "剩余价值",
          value: v.value,
          unit: v.unit,
          icon: "tabler:coins",
        };
      })(),
    ];
  }, [data, nodePriceText, monthlyAverageCostText, remainingTimeText, remainingValueText, remainingTimeValueClass]);

  if (!data) {
    return (
      <div className="p-4">
        <Card className="bg-background/50 backdrop-blur-xs border-none hover:bg-background transition-all rounded-md">
          <CardContent className="pt-6">
            <Empty description="节点不存在或已被删除">
              <Button className="mt-4" onClick={() => router.push("/")}>
                返回首页
              </Button>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Network card derived values
  const netTotalUp = data.net_total_up ?? 0;
  const netTotalDown = data.net_total_down ?? 0;
  const trafficUsed = (() => {
    const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = data;
    switch (traffic_limit_type) {
      case "up":
        return net_total_up;
      case "down":
        return net_total_down;
      case "min":
        return Math.min(net_total_up, net_total_down);
      case "max":
        return Math.max(net_total_up, net_total_down);
      case "sum":
      default:
        return net_total_up + net_total_down;
    }
  })();

  const hasTrafficLimit = (data.traffic_limit ?? 0) > 0;
  const trafficUsedPercentage =
    data.traffic_limit > 0
      ? Math.min((trafficUsed / data.traffic_limit) * 100, 100)
      : 0;
  const trafficUsageText = hasTrafficLimit
    ? `${formatBytes(trafficUsed)} / ${formatBytes(data.traffic_limit)}`
    : "无限流量";

  return (
    <div className="instance-detail space-y-4">
      <div className="px-4 flex gap-4 items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          className="bg-background/50 hover:bg-background"
          onClick={() => router.push("/")}
          aria-label="返回首页"
        >
          <Icon icon="tabler:arrow-left" width={16} height={16} />
        </Button>
        <div className="text-lg font-bold flex gap-2 items-center">
          <img
            src={`/images/flags/${getRegionCode(data.region)}.svg`}
            alt={getRegionDisplayName(data.region)}
            className="size-6"
          />
          <span>{data.name}</span>
        </div>
        <Badge variant={data.online ? "default" : "destructive"} className="text-xs !rounded">
          {data.online ? "在线" : "离线"}
        </Badge>
      </div>

      <div className="px-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metricCards.map((m) => (
          <Card
            key={m.label}
            className="group h-full bg-background/50 backdrop-blur-xs border-none hover:bg-background transition-all rounded-md"
          >
            <CardContent className="h-full !p-3">
              <div className="flex h-full min-h-10 md:min-h-18 flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium tracking-wider text-muted-foreground">
                    {m.label}
                  </span>
                  <Icon
                    icon={m.icon}
                    width={20}
                    height={20}
                    className="text-slate-500/25 transition-colors group-hover:text-slate-500"
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <div
                    className={`flex min-w-0 items-baseline gap-1 truncate font-semibold leading-none ${m.valueClass ?? ""}`}
                  >
                    <span className="truncate text-base sm:text-2xl">{m.value}</span>
                    {m.unit && (
                      <span className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">
                        {m.unit}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="px-4 gap-4 grid grid-cols-1 lg:grid-cols-2">
        <InfoCard title="硬件信息">
          <InfoGrid
            items={[
              { label: "CPU", value: `${data.cpu_name} (x${data.cpu_cores})`, icon: "icon-park-outline:cpu" },
              { label: "架构", value: data.arch, icon: "icon-park-outline:application-two" },
              { label: "虚拟化", value: data.virtualization, icon: "icon-park-outline:server" },
              { label: "GPU", value: data.gpu_name || "-", icon: "icon-park-outline:video-one" },
            ]}
          />
        </InfoCard>

        <InfoCard title="系统信息">
          <InfoGrid
            items={[
              { label: "操作系统", value: data.os, icon: "icon-park-outline:computer" },
              { label: "内核版本", value: data.kernel_version, icon: "icon-park-outline:code" },
              { label: "运行时间", value: formatUptime(data.uptime), icon: "icon-park-outline:timer" },
              { label: "最后上报", value: formatDateTime(data.time), icon: "icon-park-outline:time" },
            ]}
            iconColumn={{ "操作系统": { src: getOSImage(data.os), alt: getOSName(data.os) } }}
            osLabel="操作系统"
            osValue={data.os}
          />
        </InfoCard>

        <InfoCard title="存储信息">
          <InfoGrid
            items={[
              { label: "内存", value: formatBytes(data.mem_total), icon: "icon-park-outline:memory" },
              { label: "内存交换", value: formatBytes(data.swap_total), icon: "icon-park-outline:switch" },
              { label: "硬盘", value: formatBytes(data.disk_total), icon: "icon-park-outline:hard-disk" },
            ]}
          />
        </InfoCard>

        <InfoCard title="网络信息">
          <div className="gap-3 grid grid-cols-2">
            <div className="relative min-w-0 overflow-hidden rounded-sm bg-slate-500/5 p-2">
              {hasTrafficLimit && (
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-primary/10 pointer-events-none transition-[width] duration-300 ease-out"
                  style={{ width: `${trafficUsedPercentage}%` }}
                />
              )}
              <div className="relative flex flex-col gap-1.5">
                <div className="flex gap-1 items-center text-muted-foreground">
                  <Icon icon="icon-park-outline:transfer-data" width={14} height={14} aria-hidden="true" />
                  <span className="text-xs sm:text-sm">总流量</span>
                  <div className="flex-1" />
                  <span className="hidden sm:block text-xs font-medium text-foreground/70">
                    {formatBytes(netTotalUp)} / {formatBytes(netTotalDown)}
                  </span>
                </div>
                <span className="text-xs sm:text-sm break-all">
                  {trafficUsageText}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2">
              <div className="flex gap-1 items-center text-muted-foreground">
                <Icon icon="icon-park-outline:dashboard-one" width={14} height={14} aria-hidden="true" />
                <span className="text-xs sm:text-sm">网络速率</span>
              </div>
              <span className="text-xs sm:text-sm break-all flex flex-row flex-wrap items-center gap-1">
                <Icon icon="tabler:chevron-up" width={12} height={12} aria-hidden="true" />
                {formatBytesPerSecond(data.net_out)}
                <span className="px-0.5" />
                <Icon icon="tabler:chevron-down" width={12} height={12} aria-hidden="true" />
                {formatBytesPerSecond(data.net_in)}
              </span>
            </div>
          </div>
        </InfoCard>
      </div>

      <LoadChart uuid={data.uuid} className="px-4" />
      <PingChart uuid={data.uuid} className="px-4" />
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="group h-full bg-background/50 backdrop-blur-xs border-none hover:bg-background transition-all rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function InfoGrid({
  items,
  iconColumn,
  osLabel,
  osValue,
}: {
  items: InfoItem[];
  iconColumn?: Record<string, { src: string; alt: string }>;
  osLabel?: string;
  osValue?: string;
}) {
  return (
    <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2"
        >
          <div className="flex gap-1 items-center text-muted-foreground">
            {item.icon && <Icon icon={item.icon} width={14} height={14} aria-hidden="true" />}
            <span className="text-xs sm:text-sm">{item.label}</span>
          </div>
          <div className="flex min-w-0 gap-2 items-center">
            {osLabel === item.label && osValue && iconColumn && (
              <img
                src={iconColumn[item.label]?.src}
                alt={iconColumn[item.label]?.alt ?? ""}
                className="size-5 shrink-0"
              />
            )}
            <span className="text-xs sm:text-sm break-all">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}