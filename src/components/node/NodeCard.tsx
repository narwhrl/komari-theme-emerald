"use client";

import { Icon } from "@iconify/react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressThin } from "@/components/ui/ProgressThin";
import { useNodePingDisplay } from "@/hooks/useNodePingDisplay";
import { useAppStore } from "@/stores/app";
import type { NodeData } from "@/stores/nodes";
import {
  formatBytesPerSecondWithConfig,
  formatBytesWithConfig,
  formatDateTime,
  formatUptimeWithFormat,
  getStatus,
} from "@/utils/helper";
import { getOSImage, getOSName } from "@/utils/osImageHelper";
import { getRegionCode, getRegionDisplayName } from "@/utils/regionHelper";
import {
  formatPriceWithCycle,
  getDaysUntilExpired,
  getExpireStatus,
  getExpireTextClass,
  parseTags,
} from "@/utils/tagHelper";

interface NodeCardProps {
  node: NodeData;
  onClick?: () => void;
  onPingClick?: (node: NodeData) => void;
}

export function NodeCard({ node, onClick, onPingClick }: NodeCardProps) {
  const appStore = useAppStore();
  const byteDecimals = useAppStore((s) => s.byteDecimals);
  const lang = useAppStore((s) => s.lang);

  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, byteDecimals);
  const formatBytesPerSecond = (bytes: number) =>
    formatBytesPerSecondWithConfig(bytes, byteDecimals);
  const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, "hour");
  const offlineTime = useMemo(() => formatDateTime(node.time), [node.time]);

  const cpuStatus = getStatus(node.cpu ?? 0);
  const memPercentage = ((node.ram ?? 0) / (node.mem_total || 1)) * 100;
  const memStatus = getStatus(memPercentage);
  const diskPercentage = ((node.disk ?? 0) / (node.disk_total || 1)) * 100;
  const diskStatus = getStatus(diskPercentage);

  const {
    latencyRenderBars,
    lossRenderBars,
    latencyDisplay,
    lossDisplay,
    latencyPanelTooltip,
    lossPanelTooltip,
  } = useNodePingDisplay(node.uuid);

  const trafficUsed = (() => {
    const up = node.net_total_up ?? 0;
    const down = node.net_total_down ?? 0;
    switch (node.traffic_limit_type) {
      case "up":
        return up;
      case "down":
        return down;
      case "min":
        return Math.min(up, down);
      case "max":
        return Math.max(up, down);
      case "sum":
      default:
        return up + down;
    }
  })();

  const trafficUsedPercentage =
    node.traffic_limit > 0 ? Math.min((trafficUsed / node.traffic_limit) * 100, 100) : 0;
  const showTrafficProgress = node.traffic_limit > 0;

  interface PriceTagItem {
    text: string;
    highlightValue?: string;
    prefix?: string;
    suffix?: string;
  }

  const priceTags = useMemo<PriceTagItem[]>(() => {
    const tags: PriceTagItem[] = [];
    if (node.price !== 0) {
      const days = getDaysUntilExpired(node.expired_at);
      const status = getExpireStatus(node.expired_at);
      const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang);
      tags.push({ text: priceText });
      if (status === "expired") tags.push({ text: lang === "zh-CN" ? "已过期" : "Expired" });
      else if (status === "long_term")
        tags.push({ text: lang === "zh-CN" ? "长期" : "Long-term" });
      else if (lang === "zh-CN")
        tags.push({
          text: `剩余 ${days} 天`,
          prefix: "剩余 ",
          highlightValue: String(days),
          suffix: " 天",
        });
      else
        tags.push({
          text: `${days} days left`,
          highlightValue: String(days),
          suffix: " days left",
        });
    }
    return tags;
  }, [node, lang]);

  const remainingTimeTagClass = node.price === 0 ? "" : getExpireTextClass(node.expired_at);
  const customTags = parseTags(node.tags).map((t) => t.text);

  return (
    <Card
     
      className={`node-card w-full h-full cursor-pointer bg-background/50 border-none shadow-[0_0_0_3px] shadow-transparent hover:bg-background hover:shadow-slate-500/10 backdrop-blur-sm transition-all duration-200 rounded-md ${
        !node.online ? "!shadow-red-600/20" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex gap-2 min-w-0 items-center flex-1">
          <Tooltip>
            <TooltipTrigger>
              <div
                className={`relative size-2 rounded-full ${
                  node.online ? "bg-green-600" : "bg-red-600"
                }`}
              >
                {node.online && (
                  <span className="absolute inset-0 rounded-full bg-green-600 opacity-50 animate-ping" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="whitespace-nowrap">
              {formatUptime(node.uptime ?? 0)}
            </TooltipContent>
          </Tooltip>
          <CardTitle className="text-md font-bold flex-1 min-w-0 truncate">
            {node.name}
          </CardTitle>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <img src={getOSImage(node.os)} alt={getOSName(node.os)} className="size-4" />
          {node.region?.trim() && (
            <img
              src={`/images/flags/${getRegionCode(node.region)}.svg`}
              alt={getRegionDisplayName(node.region)}
              className="size-5 shrink-0"
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <div className="gap-3 grid grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="w-full text-xs flex flex-row justify-between">
                <span className="text-muted-foreground">CPU</span>
                <span>{(node.cpu ?? 0).toFixed(1)}%</span>
              </div>
              <ProgressThin percentage={node.cpu ?? 0} status={cpuStatus} height={4} />
              <div className="text-[11px] text-muted-foreground truncate">
                {node.load.toFixed(2)}, {node.load5.toFixed(2)}, {node.load15.toFixed(2)}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="w-full text-xs flex flex-row justify-between">
                <span className="text-muted-foreground">内存</span>
                <span>{memPercentage.toFixed(1)}%</span>
              </div>
              <ProgressThin percentage={memPercentage} status={memStatus} height={4} />
              <Tooltip>
                <TooltipTrigger>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {formatBytes(node.ram ?? 0)} / {formatBytes(node.mem_total ?? 0)}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="px-1.5 py-1 text-[10px]">
                  <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                    <span className="text-background/70">USED</span>
                    <span>{formatBytes(node.ram ?? 0)}</span>
                  </div>
                  {node.swap ? (
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                      <span className="text-background/70">SWAP</span>
                      <span>{formatBytes(node.swap ?? 0)}</span>
                    </div>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-col gap-1">
              <div className="w-full text-xs flex flex-row justify-between">
                <span className="text-muted-foreground">硬盘</span>
                <span>{diskPercentage.toFixed(1)}%</span>
              </div>
              <ProgressThin percentage={diskPercentage} status={diskStatus} height={4} />
              <div className="text-[11px] text-muted-foreground truncate">
                {formatBytes(node.disk ?? 0)} / {formatBytes(node.disk_total ?? 0)}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="w-full text-xs flex flex-row justify-between">
                <span className="text-muted-foreground">流量</span>
                <span>{trafficUsedPercentage.toFixed(1)}%</span>
              </div>
              <ProgressThin percentage={trafficUsedPercentage} status="success" height={4} />
              <div className="text-[11px] text-muted-foreground truncate">
                {formatBytes(trafficUsed)} /{" "}
                {showTrafficProgress ? formatBytes(node.traffic_limit) : "∞"}
              </div>
            </div>
          </div>

          <div className="gap-1.5 grid grid-cols-6 relative">
            {!node.online && (
              <div className="absolute inset-0 flex flex-col gap-1 items-center justify-center z-1 text-center" aria-hidden="true">
                <div className="text-sm font-medium text-destructive">离线</div>
                <div className="text-xs text-muted-foreground">{offlineTime}</div>
              </div>
            )}
            <div
              className={`flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5 ${
                priceTags.length ? "col-span-2" : "col-span-3"
              } ${!node.online ? "blur-xs opacity-60" : ""}`}
            >
              <div className="text-[11px] flex flex-col">
                <div className="text-green-600 flex flex-row items-center gap-1">
                  <Icon icon="tabler:chevron-up" width={12} height={12} />
                  {formatBytesPerSecond(node.net_out ?? 0)}
                </div>
                <div className="text-blue-600 flex flex-row items-center gap-1">
                  <Icon icon="tabler:chevron-down" width={12} height={12} />
                  {formatBytesPerSecond(node.net_in ?? 0)}
                </div>
              </div>
            </div>
            <div
              className={`flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5 ${
                priceTags.length ? "col-span-2" : "col-span-3"
              } ${!node.online ? "blur-xs opacity-60" : ""}`}
            >
              <div className="text-[11px] text-muted-foreground flex flex-col">
                <div className="flex flex-row items-center gap-1">
                  <Icon icon="tabler:upload" width={12} height={12} />
                  {formatBytes(node.net_total_up ?? 0)}
                </div>
                <div className="flex flex-row items-center gap-1">
                  <Icon icon="tabler:download" width={12} height={12} />
                  {formatBytes(node.net_total_down ?? 0)}
                </div>
              </div>
            </div>
            {priceTags.length > 0 && (
              <div
                className={`col-span-2 flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5 ${
                  !node.online ? "blur-xs opacity-60" : ""
                }`}
              >
                <div className="text-[11px] text-muted-foreground flex flex-col">
                  {priceTags.map((tag, index) => (
                    <div key={index} className="flex flex-row items-center gap-1">
                      {tag.highlightValue ? (
                        <>
                          <span>{tag.prefix}</span>
                          <span className={remainingTimeTagClass}>{tag.highlightValue}</span>
                          <span>{tag.suffix}</span>
                        </>
                      ) : (
                        <span>{tag.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              title={latencyPanelTooltip}
              aria-label={`${node.name} 延迟`}
              className={`group/panel relative col-span-3 flex h-10 cursor-pointer flex-col gap-1.5 rounded-sm bg-slate-500/5 p-1.5 text-left transition-colors hover:bg-slate-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                !node.online ? "blur-xs opacity-60" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onPingClick?.(node);
              }}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] leading-none relative">
                <span className="text-muted-foreground">延迟</span>
                <span className="font-medium text-foreground/85">{latencyDisplay}</span>
              </div>
              <div
                className="grid h-full items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
                style={{ gridTemplateColumns: `repeat(${latencyRenderBars.length}, minmax(0, 1fr))` }}
              >
                {latencyRenderBars.map((bar) => (
                  <Tooltip key={bar.key}>
                    <TooltipTrigger>
                      <span
                        className={`block h-full w-full rounded-[1px] transition-transform duration-150 ${bar.className}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="whitespace-pre-line text-[10px] px-1.5 py-1">
                      {bar.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </button>
            <button
              type="button"
              title={lossPanelTooltip}
              aria-label={`${node.name} 丢包`}
              className={`group/panel relative col-span-3 flex h-10 cursor-pointer flex-col gap-1.5 rounded-sm bg-slate-500/5 p-1.5 text-left transition-colors hover:bg-slate-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                !node.online ? "blur-xs opacity-60" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onPingClick?.(node);
              }}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
                <span className="text-muted-foreground">丢包</span>
                <span className="font-medium text-foreground/85">{lossDisplay}</span>
              </div>
              <div
                className="grid h-full items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
                style={{ gridTemplateColumns: `repeat(${lossRenderBars.length}, minmax(0, 1fr))` }}
              >
                {lossRenderBars.map((bar) => (
                  <Tooltip key={bar.key}>
                    <TooltipTrigger>
                      <span
                        className={`block h-full w-full rounded-[1px] transition-transform duration-150 ${bar.className}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="whitespace-pre-line text-[10px] px-1.5 py-1">
                      {bar.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </button>
          </div>

          {customTags.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-1 items-center">
              {customTags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="!text-[11px] rounded text-muted-foreground border-muted-foreground/10 px-1.5"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default NodeCard;