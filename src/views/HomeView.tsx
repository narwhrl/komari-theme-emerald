'use client'

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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppDerived, useAppStore } from '@/stores/app'
import { selectNodeGroups, useNodesStore } from '@/stores/nodes'
import { isNodeInGroup, parseNodeGroups } from '@/utils/groupHelper'
import { navigateTo } from '@/utils/navigation'
import { isRegionMatch } from '@/utils/regionHelper'

const nodeItemStaggerMs = 35
const nodeItemStaggerLimit = 12

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
  const derived = useAppDerived()
  const [searchText, setSearchText] = useState('')
  const [debouncedSearchText, setDebouncedSearchText] = useState('')
  const [selectedPingNodeUuid, setSelectedPingNodeUuid] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(setDebouncedSearchText, 300, searchText)
    return () => clearTimeout(timer)
  }, [searchText])

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
              <Alert variant="destructive" className="rounded-md border-none bg-red-400/10 backdrop-blur-xs">
                <AlertTitle>RPC 服务错误</AlertTitle>
                <AlertDescription>连接服务器失败，请检查网络设置或刷新页面后再试。</AlertDescription>
              </Alert>
            </div>
          )
        : null}

      {derived.alertEnabled && derived.alertContent
        ? (
            <div className="alert px-4">
              <Alert className="rounded-md border-none bg-background/60 backdrop-blur-xs">
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
            <div className="flex flex-nowrap items-start gap-2">
              <div className="overflow-x-auto rounded-sm md:pointer-events-auto">
                <TabsList className="h-8 w-max rounded-md bg-background/50 backdrop-blur-xl">
                  {groups.map(group => (
                    <TabsTrigger
                      key={group.name}
                      value={group.name}
                      className="h-6.5 flex-none shrink-0 rounded-sm border-none text-xs shadow-none data-[selected]:text-green-600"
                    >
                      {group.tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="search pointer-events-auto ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="卡片视图"
                  className={`h-8 w-8 rounded-md border-none bg-background/50 shadow-none backdrop-blur-xs hover:bg-background/60 ${derived.nodeViewMode === 'card' ? '!bg-background !text-green-600' : ''}`}
                  onClick={() => setNodeViewMode('card')}
                >
                  <Icon icon="tabler:layout-grid" width={14} height={14} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="列表视图"
                  className={`h-8 w-8 rounded-md border-none bg-background/50 shadow-none backdrop-blur-xs hover:bg-background/60 ${derived.nodeViewMode === 'list' ? '!bg-background !text-green-600' : ''}`}
                  onClick={() => setNodeViewMode('list')}
                >
                  <Icon icon="tabler:table" width={14} height={14} />
                </Button>
                <div className="relative z-1 h-8 w-8">
                  <div className="absolute top-0 right-0">
                    <Input
                      value={searchText}
                      onChange={event => setSearchText(event.target.value)}
                      placeholder="搜索节点名称、地区、系统"
                      className="h-8 w-8 rounded-md border-none bg-background/50 shadow-none backdrop-blur-xs transition-all placeholder:text-transparent hover:!bg-background/60 focus:!w-60 focus:!bg-background/80 focus:!pl-7.5 focus:placeholder:!text-muted-foreground focus:!ring-slate-500/10"
                    />
                    <Icon icon="tabler:search" width={14} height={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>
            <TabsContent value={nodeSelectedGroup} className="pointer-events-auto">
              {nodeList.length !== 0 && derived.nodeViewMode === 'card'
                ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                      {nodeList.map((node, index) => (
                        <div
                          key={`${nodeSelectedGroup}-${node.uuid}`}
                          className="min-w-0"
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
                        <Empty description="暂无节点" />
                      </div>
                    )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={Boolean(selectedPingNode)} onOpenChange={open => !open && setSelectedPingNodeUuid(null)}>
        {selectedPingNode
          ? (
              <DialogContent
                className="max-w-6xl gap-0 overflow-hidden bg-background/60 p-0 shadow-[0_0_2rem_rgba(0,0,0,0.1)]"
                overlayClass="bg-background/30"
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
