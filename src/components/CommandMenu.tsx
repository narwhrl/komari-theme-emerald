'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { selectAppDerived, useAppStore } from '@/stores/app'
import { selectNodeGroups, useNodesStore } from '@/stores/nodes'
import { parseNodeGroups } from '@/utils/groupHelper'
import { navigateTo } from '@/utils/navigation'
import { getOSName } from '@/utils/osImageHelper'
import { getRegionDisplayName } from '@/utils/regionHelper'

type CommandSection = 'search' | 'actions' | 'groups' | 'nodes'

interface CommandItem {
  id: string
  section: CommandSection
  label: string
  description: string
  icon: string
  badge?: ReactNode
  keywords: string[]
  onSelect: () => void
}

const sectionTitles: Record<CommandSection, string> = {
  search: '搜索',
  actions: '操作',
  groups: '分组',
  nodes: '节点',
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function commandMatches(item: CommandItem, query: string): boolean {
  const normalized = normalize(query)
  if (!normalized)
    return true

  return [
    item.label,
    item.description,
    ...item.keywords,
  ].some(value => normalize(value).includes(normalized))
}

function nodeDescription(node: NodeData): string {
  const parts = [
    getRegionDisplayName(node.region),
    getOSName(node.os),
    parseNodeGroups(node.group).join(' / '),
  ].filter(Boolean)
  return parts.join(' · ') || '节点详情'
}

function nodeKeywords(node: NodeData): string[] {
  return [
    node.name,
    node.uuid,
    node.region,
    node.os,
    node.tags,
    node.remark ?? '',
    node.public_remark ?? '',
    ...parseNodeGroups(node.group),
  ]
}

export default function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const nodes = useNodesStore(state => state.nodes)
  const groupsRaw = useMemo(() => selectNodeGroups(nodes), [nodes])
  const themeMode = useAppStore(state => state.themeMode)
  const homeSearchText = useAppStore(state => state.homeSearchText)
  const setHomeSearchText = useAppStore(state => state.setHomeSearchText)
  const setNodeSelectedGroup = useAppStore(state => state.setNodeSelectedGroup)
  const setNodeViewMode = useAppStore(state => state.setNodeViewMode)
  const updateThemeMode = useAppStore(state => state.updateThemeMode)
  const isLoggedIn = useAppStore(state => state.isLoggedIn)
  const hideAdminEntryWhenLoggedOut = useAppStore(state => selectAppDerived(state).hideAdminEntryWhenLoggedOut)
  const nodeViewMode = useAppStore(state => selectAppDerived(state).nodeViewMode)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    if (!open)
      return

    setQuery(homeSearchText)
    const timer = window.setTimeout(() => inputRef.current?.select(), 40)
    return () => window.clearTimeout(timer)
  }, [homeSearchText, open])

  function closeMenu() {
    onOpenChange(false)
  }

  function runCommand(command: CommandItem | undefined) {
    if (!command)
      return
    command.onSelect()
    closeMenu()
  }

  const allItems = useMemo<CommandItem[]>(() => {
    const trimmedQuery = deferredQuery.trim()
    const nextThemeLabel = themeMode === 'auto'
      ? '切换到浅色主题'
      : themeMode === 'light'
        ? '切换到深色主题'
        : '切换到跟随系统'
    const actions: CommandItem[] = [
      {
        id: 'view-card',
        section: 'actions',
        label: '卡片视图',
        description: '用卡片查看节点状态',
        icon: 'tabler:layout-grid',
        badge: nodeViewMode === 'card' ? <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">当前</Badge> : null,
        keywords: ['card', 'grid', 'view', 'layout', '卡片', '视图'],
        onSelect: () => {
          setNodeViewMode('card')
          navigateTo('/')
        },
      },
      {
        id: 'view-list',
        section: 'actions',
        label: '列表视图',
        description: '用表格密度查看节点状态',
        icon: 'tabler:table',
        badge: nodeViewMode === 'list' ? <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">当前</Badge> : null,
        keywords: ['list', 'table', 'view', 'layout', '列表', '表格'],
        onSelect: () => {
          setNodeViewMode('list')
          navigateTo('/')
        },
      },
      {
        id: 'toggle-theme',
        section: 'actions',
        label: nextThemeLabel,
        description: '调整界面明暗模式',
        icon: themeMode === 'dark' ? 'icon-park-outline:dark-mode' : 'icon-park-outline:sun-one',
        keywords: ['theme', 'dark', 'light', 'auto', '主题', '深色', '浅色'],
        onSelect: () => updateThemeMode(),
      },
    ]

    if (homeSearchText.trim()) {
      actions.unshift({
        id: 'clear-search',
        section: 'actions',
        label: '清除首页搜索',
        description: homeSearchText,
        icon: 'tabler:x',
        keywords: ['clear', 'search', 'reset', '清除', '搜索'],
        onSelect: () => {
          setHomeSearchText('')
          navigateTo('/')
        },
      })
    }

    if (isLoggedIn || !hideAdminEntryWhenLoggedOut) {
      actions.push({
        id: 'admin',
        section: 'actions',
        label: '后台管理',
        description: '打开 Komari 管理后台',
        icon: 'icon-park-outline:setting',
        keywords: ['admin', 'settings', 'manage', '后台', '管理', '设置'],
        onSelect: () => {
          window.location.href = '/admin'
        },
      })
    }

    const searchItem: CommandItem[] = trimmedQuery
      ? [{
          id: 'search-home',
          section: 'search',
          label: `搜索节点：${trimmedQuery}`,
          description: '在首页节点列表中筛选',
          icon: 'tabler:search',
          keywords: [trimmedQuery, 'filter', '搜索', '筛选'],
          onSelect: () => {
            setHomeSearchText(trimmedQuery)
            navigateTo('/')
          },
        }]
      : []

    const groupItems: CommandItem[] = [
      { label: '全部节点', value: 'all' },
      ...groupsRaw.map(group => ({ label: group, value: group })),
    ].map(group => ({
      id: `group-${group.value}`,
      section: 'groups',
      label: group.label,
      description: group.value === 'all' ? '显示所有节点' : '切换首页节点分组',
      icon: group.value === 'all' ? 'tabler:server-2' : 'tabler:folder',
      keywords: [group.label, group.value, 'group', '分组'],
      onSelect: () => {
        setNodeSelectedGroup(group.value)
        navigateTo('/')
      },
    }))

    const nodeItems: CommandItem[] = nodes.map(node => ({
      id: `node-${node.uuid}`,
      section: 'nodes',
      label: node.name,
      description: nodeDescription(node),
      icon: node.online ? 'tabler:server-bolt' : 'tabler:server-off',
      badge: node.online
        ? <span className="rounded-sm bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">在线</span>
        : <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">离线</span>,
      keywords: nodeKeywords(node),
      onSelect: () => navigateTo(`/instance/${encodeURIComponent(node.uuid)}`),
    }))

    return [...searchItem, ...actions, ...groupItems, ...nodeItems]
  }, [deferredQuery, groupsRaw, hideAdminEntryWhenLoggedOut, homeSearchText, isLoggedIn, nodeViewMode, nodes, setHomeSearchText, setNodeSelectedGroup, setNodeViewMode, themeMode, updateThemeMode])

  const visibleItems = useMemo(() => {
    const searchItems = allItems.filter(item => item.section === 'search')
    const actions = allItems.filter(item => item.section === 'actions' && commandMatches(item, deferredQuery)).slice(0, 6)
    const groups = allItems.filter(item => item.section === 'groups' && commandMatches(item, deferredQuery)).slice(0, deferredQuery.trim() ? 8 : 5)
    const nodes = allItems.filter(item => item.section === 'nodes' && commandMatches(item, deferredQuery)).slice(0, deferredQuery.trim() ? 10 : 6)
    return [...searchItems, ...actions, ...groups, ...nodes]
  }, [allItems, deferredQuery])

  useEffect(() => {
    setActiveIndex(0)
  }, [deferredQuery, visibleItems.length])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, Math.max(visibleItems.length - 1, 0)))
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
    }
    else if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(visibleItems[activeIndex])
    }
  }

  const groupedSections = (['search', 'actions', 'groups', 'nodes'] satisfies CommandSection[])
    .map(section => ({
      section,
      items: visibleItems.filter(item => item.section === section),
    }))
    .filter(group => group.items.length > 0)
  const activeItem = visibleItems[activeIndex]
  const sectionStats = groupedSections.map(group => ({
    section: group.section,
    title: sectionTitles[group.section],
    count: group.items.length,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="command-dialog top-14 max-h-[min(720px,calc(100dvh-4rem))] max-w-3xl translate-y-0 gap-0 overflow-hidden rounded-xl border-border/80 bg-background/96 p-0 shadow-[0_22px_70px_rgb(15_23_42/18%)] backdrop-blur-xl sm:top-20 dark:shadow-[0_24px_80px_rgb(0_0_0/56%)]"
        overlayClass="bg-background/45 backdrop-blur-[2px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>命令菜单</DialogTitle>
          <DialogDescription>搜索节点或执行常用操作</DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/80 bg-muted/18">
          <div className="flex items-center gap-3 py-3 pr-14 pl-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-xs">
              <Icon icon="tabler:search" width={18} height={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor="komari-command-input" className="sr-only">搜索节点或执行操作</label>
              <Input
                id="komari-command-input"
                ref={inputRef}
                type="search"
                name="command-search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                role="combobox"
                aria-expanded="true"
                aria-controls="komari-command-list"
                aria-activedescendant={activeItem ? `komari-command-${activeItem.id}` : undefined}
                aria-label="搜索节点或执行操作"
                placeholder="搜索节点、分组或操作…"
                className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              />
            </div>
            <span className="hidden shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              {visibleItems.length}
              {' '}
              项
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 pr-14">
            {sectionStats.length
              ? sectionStats.map(stat => (
                  <span key={stat.section} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {stat.title}
                    <span className="vercel-number text-foreground">{stat.count}</span>
                  </span>
                ))
              : (
                  <span className="inline-flex shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">无结果</span>
                )}
          </div>
        </div>

        <div id="komari-command-list" role="listbox" className="max-h-[min(540px,calc(100dvh-13rem))] overflow-y-auto overscroll-contain p-2">
          {groupedSections.length
            ? groupedSections.map(group => (
                <CommandGroup key={group.section} title={sectionTitles[group.section]} count={group.items.length}>
                  {group.items.map((item) => {
                    const itemIndex = visibleItems.findIndex(visibleItem => visibleItem.id === item.id)
                    const active = itemIndex === activeIndex
                    return (
                      <button
                        id={`komari-command-${item.id}`}
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          'motion-command-item grid min-h-14 w-full cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-[background-color,color,box-shadow,transform] duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/30',
                          active ? 'bg-foreground text-background shadow-sm' : 'text-foreground hover:bg-accent/70',
                        )}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => runCommand(item)}
                      >
                        <span className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors',
                          active ? 'border-background/20 bg-background/15 text-background' : 'border-border bg-background text-muted-foreground',
                        )}
                        >
                          <Icon icon={item.icon} width={17} height={17} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className={cn('block truncate text-xs', active ? 'text-background/70' : 'text-muted-foreground')}>{item.description}</span>
                        </span>
                        {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
                      </button>
                    )
                  })}
                </CommandGroup>
              ))
            : (
                <div className="py-10">
                  <Empty description="没有匹配项，试试节点名称、地区或分组" />
                </div>
              )}
        </div>

        <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border bg-muted/12 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">
            {activeItem ? `${sectionTitles[activeItem.section]} / ${activeItem.label}` : '没有可选项目'}
          </span>
          <span className="vercel-number shrink-0 rounded-full border border-border bg-background px-2 py-0.5 font-medium text-foreground">
            {visibleItems.length ? `${Math.min(activeIndex + 1, visibleItems.length)} / ${visibleItems.length}` : '0'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CommandGroup({ title, count, children }: { title: string, count: number, children: ReactNode }) {
  return (
    <section className="mb-2 last:mb-0" aria-label={title}>
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="vercel-number">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  )
}
