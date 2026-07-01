"use client";

import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ProgressThin } from "@/components/ui/ProgressThin";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NodePingListCell } from "@/components/node/NodePingListCell";
import { TrafficProgress } from "@/components/node/TrafficProgress";
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

interface ColumnConfig {
  key: string;
  label: string;
  width: string | number;
  sortable: boolean;
}

interface PriceTagItem {
  text: string;
  highlightValue?: string;
  prefix?: string;
  suffix?: string;
}

interface NodeListProps {
  nodes: NodeData[];
  transitionKey?: string;
  onClick?: (node: NodeData) => void;
  onPingClick?: (node: NodeData) => void;
}

const ROW_STAGGER_MS = 35;
const ROW_STAGGER_LIMIT = 12;

const COLUMNS: ColumnConfig[] = [
  { key: "status", label: "状态", width: "40px", sortable: false },
  { key: "os", label: "系统", width: "40px", sortable: false },
  { key: "name", label: "节点", width: "minmax(160px, 0.8fr)", sortable: true },
  { key: "tags", label: "标签", width: "minmax(200px, 1fr)", sortable: false },
  { key: "uptime", label: "运行时间", width: "116px", sortable: true },
  { key: "cpu", label: "CPU", width: "100px", sortable: false },
  { key: "mem", label: "内存", width: "100px", sortable: false },
  { key: "disk", label: "硬盘", width: "100px", sortable: false },
  { key: "traffic", label: "流量", width: "100px", sortable: false },
  { key: "rate", label: "速率", width: "80px", sortable: true },
];

export function NodeList({ nodes, transitionKey, onClick, onPingClick }: NodeListProps) {
  const byteDecimals = useAppStore((s) => s.byteDecimals);
  const lang = useAppStore((s) => s.lang);

  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function handleSort(col: ColumnConfig) {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir(sortDir === 1 ? -1 : 1);
    else {
      setSortKey(col.key);
      setSortDir(1);
    }
  }

  const sortedNodes = useMemo(() => {
    const list = [...nodes];
    if (!sortKey) return list;
    const dir = sortDir;
    return list.sort((a, b) => {
      switch (sortKey) {
        case "status":
          return dir * ((a.online ? 1 : 0) - (b.online ? 1 : 0));
        case "name": {
          const va = (a.name || "").toLowerCase();
          const vb = (b.name || "").toLowerCase();
          return dir * (va < vb ? -1 : va > vb ? 1 : 0);
        }
        case "uptime":
          return dir * ((a.uptime ?? 0) - (b.uptime ?? 0));
        case "cpu":
          return dir * ((a.cpu ?? 0) - (b.cpu ?? 0));
        case "mem":
          return dir * (
            (a.ram ?? 0) / (a.mem_total || 1) - (b.ram ?? 0) / (b.mem_total || 1)
          );
        case "disk":
          return dir * (
            (a.disk ?? 0) / (a.disk_total || 1) - (b.disk ?? 0) / (b.disk_total || 1)
          );
        case "traffic":
        case "rate":
          return dir * (((a.net_out ?? 0) + (a.net_in ?? 0)) - ((b.net_out ?? 0) + (b.net_in ?? 0)));
        default:
          return 0;
      }
    });
  }, [nodes, sortKey, sortDir]);

  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, byteDecimals);
  const formatBytesPerSecond = (bytes: number) =>
    formatBytesPerSecondWithConfig(bytes, byteDecimals);
  const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, "hour");

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: COLUMNS.map((c) => c.width).join(" "),
    }),
    [],
  );

  function getFlagSrc(region: string): string {
    return `/images/flags/${getRegionCode(region)}.svg`;
  }
  function hasRegion(region: string | null | undefined): boolean {
    return Boolean(region?.trim());
  }
  function getRowTransitionKey(node: NodeData): string {
    return transitionKey ? `${transitionKey}-${node.uuid}` : node.uuid;
  }
  function getRowTransitionStyle(index: number): React.CSSProperties {
    return { ["--node-row-delay" as string]: `${Math.min(index, ROW_STAGGER_LIMIT) * ROW_STAGGER_MS}ms` };
  }
  function showTrafficProgress(node: NodeData): boolean {
    return node.traffic_limit > 0;
  }
  function getTrafficUsed(node: NodeData): number {
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
  }
  function getTrafficUsedPercentage(node: NodeData): number {
    if (node.traffic_limit <= 0) return 0;
    return Math.min((getTrafficUsed(node) / node.traffic_limit) * 100, 100);
  }
  function formatOfflineTime(node: NodeData): string {
    return formatDateTime(node.time);
  }
  function getPriceTags(node: NodeData): PriceTagItem[] {
    const tags: PriceTagItem[] = [];
    if (node.price !== 0) {
      const days = getDaysUntilExpired(node.expired_at);
      const status = getExpireStatus(node.expired_at);
      tags.push({ text: formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang) });
      if (status === "expired") tags.push({ text: lang === "zh-CN" ? "已过期" : "Expired" });
      else if (status === "long_term") tags.push({ text: lang === "zh-CN" ? "长期" : "Long-term" });
      else if (lang === "zh-CN")
        tags.push({ text: `剩余 ${days} 天`, prefix: "剩余 ", highlightValue: String(days), suffix: " 天" });
      else
        tags.push({ text: `${days} days left`, highlightValue: String(days), suffix: " days left" });
    }
    return tags;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px] text-xs">
        <div className="gap-2 grid items-center pb-2 border-b border-border text-muted-foreground" style={gridStyle}>
          {COLUMNS.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => handleSort(col)}
              className={`text-left px-2 ${col.sortable ? "cursor-pointer hover:text-foreground" : "cursor-default"}`}
            >
              {col.label}
              {sortKey === col.key && (
                <Icon
                  icon={sortDir === 1 ? "tabler:arrow-up" : "tabler:arrow-down"}
                  className="inline ml-1"
                  width={12}
                  height={12}
                />
              )}
            </button>
          ))}
        </div>

        <div>
          {sortedNodes.map((node, index) => {
            const cpuStatus = getStatus(node.cpu ?? 0);
            const memPercentage = ((node.ram ?? 0) / (node.mem_total || 1)) * 100;
            const memStatus = getStatus(memPercentage);
            const diskPercentage = ((node.disk ?? 0) / (node.disk_total || 1)) * 100;
            const diskStatus = getStatus(diskPercentage);
            const customTags = parseTags(node.tags).map((t) => t.text);
            const priceTags = getPriceTags(node);
            const remainingTimeTagClass =
              node.price === 0 ? "" : getExpireTextClass(node.expired_at);

            return (
              <div
                key={getRowTransitionKey(node)}
                className="gap-2 grid items-center py-2 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                style={gridStyle}
                onClick={() => onClick?.(node)}
              >
                <div className="px-2 relative size-2">
                  <span
                    className={`block size-2 rounded-full ${node.online ? "bg-green-600" : "bg-red-600"}`}
                  />
                  {node.online && (
                    <span className="absolute inset-0 rounded-full bg-green-600 opacity-50 animate-ping" />
                  )}
                </div>
                <div className="px-2">
                  <img src={getOSImage(node.os)} alt={getOSName(node.os)} className="size-4" />
                </div>
                <div className="px-2 min-w-0 flex items-center gap-2">
                  {hasRegion(node.region) && (
                    <img src={getFlagSrc(node.region!)} alt={getRegionDisplayName(node.region!)} className="size-4 shrink-0" />
                  )}
                  <span className="truncate font-medium">{node.name}</span>
                </div>
                <div className="px-2 flex flex-wrap gap-1">
                  {customTags.length > 0 ? (
                    customTags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="!text-[10px] rounded text-muted-foreground border-muted-foreground/10 px-1.5">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
                <div className="px-2 text-muted-foreground truncate">{formatUptime(node.uptime ?? 0)}</div>
                <div className="px-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CPU</span>
                    <span>{(node.cpu ?? 0).toFixed(1)}%</span>
                  </div>
                  <ProgressThin percentage={node.cpu ?? 0} status={cpuStatus} height={3} />
                </div>
                <div className="px-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MEM</span>
                    <span>{memPercentage.toFixed(1)}%</span>
                  </div>
                  <ProgressThin percentage={memPercentage} status={memStatus} height={3} />
                </div>
                <div className="px-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DISK</span>
                    <span>{diskPercentage.toFixed(1)}%</span>
                  </div>
                  <ProgressThin percentage={diskPercentage} status={diskStatus} height={3} />
                </div>
                <div className="px-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">流量</span>
                    <span>{getTrafficUsedPercentage(node).toFixed(1)}%</span>
                  </div>
                  {showTrafficProgress(node) ? (
                    <TrafficProgress
                      upload={node.net_total_up ?? 0}
                      download={node.net_total_down ?? 0}
                      trafficLimit={node.traffic_limit}
                      trafficLimitType={node.traffic_limit_type}
                      height={3}
                    />
                  ) : (
                    <span className="text-muted-foreground">∞</span>
                  )}
                </div>
                <div
                  className="px-2 text-right text-muted-foreground truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPingClick?.(node);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPingClick?.(node);
                    }
                  }}
                >
                  <NodePingListCell uuid={node.uuid} online={node.online} />
                </div>

                {!node.online && (
                  <div
                    className="px-2 col-span-full flex flex-row items-center gap-2 text-destructive text-xs"
                    style={getRowTransitionStyle(index)}
                  >
                    <span className="font-medium">离线</span>
                    <span className="text-muted-foreground">{formatOfflineTime(node)}</span>
                  </div>
                )}

                {priceTags.length > 0 && (
                  <div className="px-2 col-span-full text-[10px] text-muted-foreground flex flex-wrap gap-3">
                    {priceTags.map((tag, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {tag.highlightValue ? (
                          <>
                            <span>{tag.prefix}</span>
                            <span className={remainingTimeTagClass}>{tag.highlightValue}</span>
                            <span>{tag.suffix}</span>
                          </>
                        ) : (
                          <span>{tag.text}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default NodeList;