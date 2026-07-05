'use client'

import type { NodeViewMode } from '@/stores/app'
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import NodeCard from '@/components/NodeCard'
import NodeGeneralCards from '@/components/NodeGeneralCards'
import NodeList from '@/components/NodeList'
import PingChart from '@/components/PingChart'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { DataTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAppDerived, useAppStore } from '@/stores/app'
import { selectNodeGroups, useNodesStore } from '@/stores/nodes'
import { isNodeInGroup, parseNodeGroups } from '@/utils/groupHelper'
import { navigateTo } from '@/utils/navigation'
import { isRegionMatch } from '@/utils/regionHelper'

const nodeItemStaggerMs = 35
const nodeItemStaggerLimit = 12
const nodeViewModeOptions: Array<{ mode: NodeViewMode, label: string, icon: string }> = [
  { mode: 'card', label: '卡片视图', icon: 'tabler:layout-grid' },
  { mode: 'list', label: '列表视图', icon: 'tabler:table' },
]

function isNodeMatchSearch(node: NodeData, search: string): boolean {
  if (!search.trim())
    return true
  const lowerSearch = search.toLowerCase().trim()
  if (node.name.toLowerCase().includes(lowerSearch))
    return true
  if (node.region && isRegionMatch(node.region, search))
    return true
  if (node.os && node.os.toLowerCase().includes(lowerSearch))
    return true
  if (parseNodeGroups(node.group).some(group => group.toLowerCase().includes(lowerSearch)))
    return true
  if (node.tags && node.tags.toLowerCase().includes(lowerSearch))
    return true
  if (node.remark && node.remark.toLowerCase().includes(lowerSearch))
    return true
  return false
}

export default function HomeView() {
  const nodes = useNodesStore(state => state.nodes)
  const earthNodes = useNodesStore(state => state.earthNodes)
  const groupsRaw = useMemo(() => selectNodeGroups(nodes), [nodes])
  const connectionError = useAppStore(state => state.connectionError)
  const homeScrollPosition = useAppStore(state => state.homeScrollPosition)
  const setHomeScrollPosition = useAppStore(state => state.setHomeScrollPosition)
  const nodeSelectedGroup = useAppStore(state => state.nodeSelectedGroup)
  const setNodeSelectedGroup = useAppStore(state => state.setNodeSelectedGroup)
  const setNodeViewMode = useAppStore(state => state.setNodeViewMode)
  const homeSearchText = useAppStore(state => state.homeSearchText)
  const setHomeSearchText = useAppStore(state => state.setHomeSearchText)
  const derived = useAppDerived()
  const [debouncedSearchText, setDebouncedSearchText] = useState('')
  const [selectedPingNodeUuid, setSelectedPingNodeUuid] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(setDebouncedSearchText, 180, homeSearchText)
    return () => clearTimeout(timer)
  }, [homeSearchText])

  useEffect(() => {
    if (homeScrollPosition > 0)
      window.scrollTo({ top: homeScrollPosition, behavior: 'instant' })
    return () => setHomeScrollPosition(window.scrollY)
  }, [homeScrollPosition, setHomeScrollPosition])

  useEffect(() => {
    if (nodeSelectedGroup !== 'all' && !groupsRaw.includes(nodeSelectedGroup))
      setNodeSelectedGroup('all')
  }, [groupsRaw, nodeSelectedGroup, setNodeSelectedGroup])

  const groups = useMemo(() => [
    { tab: '全部节点', name: 'all' },
    ...groupsRaw.map(group => ({ tab: group, name: group })),
  ], [groupsRaw])

  const groupNodeList = useMemo(() => nodes.filter(node => isNodeInGroup(node.group, nodeSelectedGroup)), [nodeSelectedGroup, nodes])
  const sampledGroupNodeList = useMemo(() => earthNodes.filter(node => isNodeInGroup(node.group, nodeSelectedGroup)), [nodeSelectedGroup, earthNodes])
  const nodeList = useMemo(() => {
    let filtered = groupNodeList
    if (debouncedSearchText.trim())
      filtered = filtered.filter(node => isNodeMatchSearch(node, debouncedSearchText))
    return filtered
  }, [debouncedSearchText, groupNodeList])
  const selectedPingNode = selectedPingNodeUuid ? nodes.find(node => node.uuid === selectedPingNodeUuid) ?? null : null

  function handleNodeClick(node: NodeData) {
    navigateTo(`/instance/${encodeURIComponent(node.uuid)}`)
  }

  return (
    <div className="home-view">
      {connectionError
        ? (
            <div className="alert px-4">
              <Alert variant="destructive">
                <AlertTitle>RPC 服务错误</AlertTitle>
                <AlertDescription>连接服务器失败，请检查网络设置或刷新页面后再试。</AlertDescription>
              </Alert>
            </div>
          )
        : null}

      {derived.alertEnabled && derived.alertContent
        ? (
            <div className="alert px-4">
              <Alert>
                {derived.alertTitle ? <AlertTitle>{derived.alertTitle}</AlertTitle> : null}
                <AlertDescription>
                  <MarkdownRenderer content={derived.alertContent} />
                </AlertDescription>
              </Alert>
            </div>
          )
        : null}

      {derived.earthViewMode !== 'hide'
        ? (
            <NodeGeneralCards
              nodes={groupNodeList}
              globeNodes={sampledGroupNodeList}
              transitionKey={nodeSelectedGroup}
            />
          )
        : null}

      <div className={`node-info relative z-1 flex flex-col gap-4 p-4 pt-0 md:pointer-events-none ${derived.earthViewMode === 'hide' ? 'pt-4' : ''}`}>
        <div className="nodes">
          <Tabs value={nodeSelectedGroup} onValueChange={value => setNodeSelectedGroup(String(value))} className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 overflow-x-auto rounded-sm md:pointer-events-auto">
                <TabsList aria-label="节点分组">
                  {groups.map(group => (
                    <TabsTab
                      key={group.name}
                      value={group.name}
                    >
                      {group.tab}
                    </TabsTab>
                  ))}
                </TabsList>
              </div>
              <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 md:pointer-events-auto">
                {homeSearchText.trim()
                  ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="motion-chip pointer-events-auto h-8 min-w-0 max-w-[min(13rem,45vw)] gap-1.5 rounded-lg bg-popover px-2 text-xs shadow-xs/5 sm:max-w-[18rem]"
                        onClick={() => setHomeSearchText('')}
                      >
                        <Icon icon="tabler:search" width={13} height={13} className="shrink-0" />
                        <span className="truncate">{homeSearchText.trim()}</span>
                        <Icon icon="tabler:x" width={13} height={13} className="shrink-0 text-muted-foreground" />
                      </Button>
                    )
                  : null}
                <NodeViewModeToggle value={derived.nodeViewMode} onValueChange={setNodeViewMode} />
              </div>
            </div>
            <TabsPanel value={nodeSelectedGroup} className="pointer-events-auto">
              {nodeList.length !== 0 && derived.nodeViewMode === 'card'
                ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                      {nodeList.map((node, index) => (
                        <div
                          key={`${nodeSelectedGroup}-${node.uuid}`}
                          className="motion-stagger-item min-w-0"
                          style={{ animationDelay: `${Math.min(index, nodeItemStaggerLimit) * nodeItemStaggerMs}ms` }}
                        >
                          <NodeCard node={node} onClick={() => handleNodeClick(node)} onPingClick={node => setSelectedPingNodeUuid(node.uuid)} />
                        </div>
                      ))}
                    </div>
                  )
                : nodeList.length !== 0 && derived.nodeViewMode === 'list'
                  ? (
                      <NodeList
                        nodes={nodeList}
                        transitionKey={nodeSelectedGroup}
                        onClick={handleNodeClick}
                        onPingClick={node => setSelectedPingNodeUuid(node.uuid)}
                      />
                    )
                  : (
                      <div className="py-8 text-center text-muted-foreground">
                        <Empty description={debouncedSearchText.trim() ? '没有匹配的节点' : '暂无节点'} />
                      </div>
                    )}
            </TabsPanel>
          </Tabs>
        </div>
      </div>

      <Dialog open={Boolean(selectedPingNode)} onOpenChange={open => !open && setSelectedPingNodeUuid(null)}>
        {selectedPingNode
          ? (
              <DialogContent
                className="max-w-6xl gap-0 overflow-hidden border-input bg-popover p-0 shadow-lg/5"
                overlayClass="bg-black/32"
              >
                <DialogHeader className="flex h-13 flex-row items-center px-4">
                  <DialogTitle className="truncate">
                    {selectedPingNode.name}
                    {' '}
                    延迟 / 丢包
                  </DialogTitle>
                </DialogHeader>
                <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4 pt-0">
                  <PingChart uuid={selectedPingNode.uuid} />
                </div>
              </DialogContent>
            )
          : null}
      </Dialog>
    </div>
  )
}

function NodeViewModeToggle({ value, onValueChange }: { value: NodeViewMode, onValueChange: (mode: NodeViewMode) => void }) {
  return (
    <div role="group" aria-label="节点视图切换" className="pointer-events-auto inline-flex shrink-0 items-center rounded-lg border border-input bg-muted/72 p-0.5 shadow-xs/5">
      {nodeViewModeOptions.map((option) => {
        const active = value === option.mode
        return (
          <DataTooltip key={option.mode} content={option.label} placement="top" contentClass="whitespace-nowrap text-[11px] px-2">
            <button
              type="button"
              aria-label={option.label}
              aria-pressed={active}
              className={cn(
                'flex h-9 min-w-10 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,box-shadow] duration-150 ease-out hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                active && 'bg-background text-foreground shadow-xs/5 hover:bg-background dark:bg-input/64',
              )}
              onClick={() => onValueChange(option.mode)}
            >
              <Icon icon={option.icon} width={17} height={17} />
            </button>
          </DataTooltip>
        )
      })}
    </div>
  )
}
