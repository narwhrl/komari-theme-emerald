/**
 * Home page (Next.js App Router) — equivalent to `views/HomeView.vue`.
 *
 * Composition:
 *   - Connection-error / alert banners
 *   - `<NodeGeneralCards>` (header area with earth/maps/cards views)
 *   - Search + view-mode switcher + group tabs
 *   - Card or list view of nodes
 *   - Dialog with `<PingChart>` for the selected node
 */
"use client";

import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty } from "@/components/ui/EmptyCompat";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useAppStore, useEffectiveViewMode } from "@/stores/app";
import { useNodesStore, type NodeData } from "@/stores/nodes";
import { isNodeInGroup, parseNodeGroups } from "@/utils/groupHelper";
import { isRegionMatch } from "@/utils/regionHelper";
import { useDebounce } from "@/hooks/useDebounce";
import { announce, announceAssertive } from "@/components/a11y/LiveAnnouncer";

// Lazy-loaded heavy views (matches Vue's `defineAsyncComponent` strategy)
const NodeCard = dynamic(
  () => import("@/components/node/NodeCard").then((m) => m.NodeCard),
  { ssr: false, loading: () => <div className="h-40 rounded-md bg-muted/20 animate-pulse" /> },
);
const NodeGeneralCards = dynamic(
  () =>
    import("@/components/node/NodeGeneralCards").then(
      (m) => m.NodeGeneralCards,
    ),
  { ssr: false, loading: () => <div className="h-40 rounded-md bg-muted/20 animate-pulse" /> },
);
const NodeList = dynamic(
  () => import("@/components/node/NodeList").then((m) => m.NodeList),
  { ssr: false, loading: () => <div className="h-40 rounded-md bg-muted/20 animate-pulse" /> },
);
const PingChart = dynamic(
  () => import("@/components/charts/PingChart").then((m) => m.PingChart),
  { ssr: false, loading: () => <div className="h-40 rounded-md bg-muted/20 animate-pulse" /> },
);

const NODE_ITEM_STAGGER_MS = 35;
const NODE_ITEM_STAGGER_LIMIT = 12;
const SEARCH_DEBOUNCE_MS = 200;

function isNodeMatchSearch(node: NodeData, search: string): boolean {
  if (!search.trim()) return true;
  const lower = search.toLowerCase().trim();
  if (node.name.toLowerCase().includes(lower)) return true;
  if (node.region && isRegionMatch(node.region, search)) return true;
  if (node.os && node.os.toLowerCase().includes(lower)) return true;
  if (parseNodeGroups(node.group).some((g) => g.toLowerCase().includes(lower)))
    return true;
  if (node.tags && node.tags.toLowerCase().includes(lower)) return true;
  if (node.remark && node.remark.toLowerCase().includes(lower)) return true;
  return false;
}

export default function HomePage() {
  const router = useRouter();
  const connectionError = useAppStore((s) => s.connectionError);
  const alertEnabled = useAppStore((s) => s.getAlertEnabled());
  const alertTitle = useAppStore((s) => s.getAlertTitle());
  const alertContent = useAppStore((s) => s.getAlertContent());
  const earthViewMode = useAppStore((s) => s.getEarthViewMode());

  const nodeSelectedGroup = useAppStore((s) => s.nodeSelectedGroup);
  const setNodeSelectedGroup = useAppStore((s) => s.setNodeSelectedGroup);
  const nodeViewMode = useEffectiveViewMode();
  const setNodeViewMode = useAppStore((s) => s.setNodeViewMode);

  const nodes = useNodesStore((s) => s.nodes);
  const earthNodes = useNodesStore((s) => s.earthNodes);
  const groups = useNodesStore((s) => s.groups);

  const [searchText, setSearchText] = useState("");
  // Debounced search text — useDebounce hook defers heavy filtering work so
  // typing remains responsive on large node lists.
  const debouncedSearchText = useDebounce(searchText, SEARCH_DEBOUNCE_MS);
  // Dialog state is controlled via a boolean flag derived from a UUID, not the
  // derived boolean. The previous code used `open={selectedPingNode !== null}`
  // which forces the controlled prop to be out of sync with the actual trigger
  // intent (a user can only open it via the node list, never directly).
  const [selectedPingNodeUuid, setSelectedPingNodeUuid] = useState<
    string | null
  >(null);

  // Stable handlers so memoised children don't re-render unnecessarily.
  const handleCardView = useCallback(() => {
    setNodeViewMode("card");
    announce("已切换为卡片视图");
  }, [setNodeViewMode]);
  const handleListView = useCallback(() => {
    setNodeViewMode("list");
    announce("已切换为列表视图");
  }, [setNodeViewMode]);
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value),
    [],
  );
  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setSelectedPingNodeUuid(null);
    },
    [],
  );
  const openPingFor = useCallback(
    (node: NodeData) => setSelectedPingNodeUuid(node.uuid),
    [],
  );
  // `NodeCard.onClick` is `() => void` because the node is captured via
  // closure. We bind it here so the callback identity stays stable across
  // re-renders (the Card calls it from many places).
  const navigateToInstance = useCallback(
    () => undefined,
    [],
  );
  const handleCardClick = useCallback(
    (node: NodeData) => router.push(`/instance/${node.uuid}`),
    [router],
  );

  // Reset group selection if the current group disappears from the list.
  // This is a real side effect (state setter that needs to run after
  // render), so it belongs in useEffect — useMemo would run during
  // render and could trigger cascading updates.
  useEffect(() => {
    if (nodeSelectedGroup !== "all" && !groups.includes(nodeSelectedGroup)) {
      setNodeSelectedGroup("all");
    }
  }, [groups, nodeSelectedGroup, setNodeSelectedGroup]);

  // Announce connection errors to assistive tech. We track the previous
  // value with a ref so the message only fires on transition false → true.
  const prevConnectionError = useRef(false);
  useEffect(() => {
    if (connectionError && !prevConnectionError.current) {
      announceAssertive("RPC 服务连接失败，请检查网络或刷新页面重试。");
    }
    prevConnectionError.current = connectionError;
  }, [connectionError]);

  const groupNodeList = useMemo(
    () => nodes.filter((n) => isNodeInGroup(n.group, nodeSelectedGroup)),
    [nodes, nodeSelectedGroup],
  );
  const sampledGroupNodeList = useMemo(
    () => earthNodes.filter((n) => isNodeInGroup(n.group, nodeSelectedGroup)),
    [earthNodes, nodeSelectedGroup],
  );

  const nodeList = useMemo(() => {
    if (!debouncedSearchText.trim()) return groupNodeList;
    return groupNodeList.filter((n) =>
      isNodeMatchSearch(n, debouncedSearchText),
    );
  }, [groupNodeList, debouncedSearchText]);

  const selectedPingNode = useMemo(
    () =>
      selectedPingNodeUuid
        ? nodes.find((n) => n.uuid === selectedPingNodeUuid) ?? null
        : null,
    [nodes, selectedPingNodeUuid],
  );

  const groupTabs = useMemo(
    () => [
      { tab: "全部节点", name: "all" },
      ...groups.map((g) => ({ tab: g, name: g })),
    ],
    [groups],
  );

  return (
    <div>
      {connectionError && (
        <div className="alert px-4">
          <Alert
            variant="error"
            className="border-none backdrop-blur-xs bg-red-400/10 rounded-md"
            role="alert"
          >
            <AlertTitle>RPC 服务错误</AlertTitle>
            <AlertDescription>
              连接服务器失败，请检查网络设置或刷新页面后再试。
            </AlertDescription>
          </Alert>
        </div>
      )}

      {alertEnabled && alertContent && (
        <div className="alert px-4">
          <Alert className="border-none bg-background/60 backdrop-blur-xs rounded-md">
            {alertTitle && <AlertTitle>{alertTitle}</AlertTitle>}
            <AlertDescription>
              <MarkdownRenderer content={alertContent} />
            </AlertDescription>
          </Alert>
        </div>
      )}

      {earthViewMode !== "hide" && (
        <NodeGeneralCards
          nodes={groupNodeList}
          globeNodes={sampledGroupNodeList}
          transitionKey={nodeSelectedGroup}
        />
      )}

      <div
        className={`node-info p-4 pt-0 flex flex-col gap-4 relative z-1 md:pointer-events-none ${
          earthViewMode === "hide" ? "pt-4" : ""
        }`}
      >
        <Tabs
          value={nodeSelectedGroup}
          onValueChange={setNodeSelectedGroup}
          className="w-full flex-col gap-4"
        >
          <div className="flex gap-2 items-start flex-nowrap">
            <div className="overflow-x-auto rounded-sm md:pointer-events-auto">
              <TabsList className="w-max h-8 bg-background/50 backdrop-blur-xl rounded-md">
                {groupTabs.map((g) => (
                  <TabsTrigger
                    key={g.name}
                    value={g.name}
                    className="h-6.5 flex-none shrink-0 text-xs border-none data-[state=active]:text-green-600 shadow-none rounded-sm"
                  >
                    {g.tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="ml-auto search flex gap-2 items-center pointer-events-auto">
              <Button
                variant="outline"
                size="icon"
                aria-label="卡片视图"
                aria-pressed={nodeViewMode === "card"}
                className={cn(
                  "w-8 h-8 border-none bg-background/50 backdrop-blur-xs shadow-none hover:bg-background/60 rounded-md",
                  nodeViewMode === "card" &&
                    "text-green-600 bg-background",
                )}
                onClick={handleCardView}
              >
                <Icon icon="tabler:layout-grid" width={14} height={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="列表视图"
                aria-pressed={nodeViewMode === "list"}
                className={cn(
                  "w-8 h-8 border-none bg-background/50 backdrop-blur-xs shadow-none hover:bg-background/60 rounded-md",
                  nodeViewMode === "list" &&
                    "text-green-600 bg-background",
                )}
                onClick={handleListView}
              >
                <Icon icon="tabler:table" width={14} height={14} />
              </Button>
              <div className="relative z-1 w-8 h-8">
                <Input
                  type="search"
                  value={searchText}
                  onChange={handleSearchChange}
                  placeholder="搜索节点名称、地区、系统"
                  aria-label="搜索节点（按名称、地区或系统）"
                  className={cn(
                    "border-none shadow-none w-8 h-8 rounded-md",
                    "bg-background/50 backdrop-blur-xs",
                    "hover:bg-background/60",
                    "focus:w-60 focus:pl-7.5 focus:bg-background/80 focus:ring-slate-500/10",
                    // Hide the placeholder until the field is focused, so the
                    // collapsed state stays visually quiet.
                    "placeholder:text-transparent focus:placeholder:text-muted-foreground",
                    // Animate only the props that change. Avoid `transition-all`.
                    "transition-[width,background-color,padding] duration-200",
                  )}
                />
                <Icon
                  icon="tabler:search"
                  width={14}
                  height={14}
                  aria-hidden="true"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>
          </div>
          <TabsContent
            value={nodeSelectedGroup}
            className="pointer-events-auto"
          >
            {nodeList.length === 0 ? (
              <Empty description="暂无节点" />
            ) : nodeViewMode === "card" ? (
              <div className="gap-3 grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                {nodeList.map((node, index) => (
                  <div
                    key={`${nodeSelectedGroup}-${node.uuid}`}
                    className="min-w-0"
                    style={{
                      animationDelay: `${Math.min(index, NODE_ITEM_STAGGER_LIMIT) * NODE_ITEM_STAGGER_MS}ms`,
                    }}
                  >
                    <NodeCard
                      node={node}
                      onClick={() => handleCardClick(node)}
                      onPingClick={openPingFor}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <NodeList
                nodes={nodeList}
                transitionKey={nodeSelectedGroup}
                onClick={handleCardClick}
                onPingClick={openPingFor}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={selectedPingNode !== null}
        onOpenChange={handleDialogOpenChange}
      >
        {selectedPingNode && (
          <DialogContent className="max-w-6xl gap-0 overflow-hidden bg-background/60 p-0 shadow-[0_0_2rem_rgba(0,0,0,0.1)]">
            <DialogHeader className="flex h-13 flex-row items-center px-4">
              <DialogTitle className="truncate">
                {selectedPingNode.name} 延迟 / 丢包
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4 pt-0">
              <PingChart uuid={selectedPingNode.uuid} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}