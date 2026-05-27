<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, defineAsyncComponent, nextTick, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { isRegionMatch } from '@/utils/regionHelper'

defineOptions({ name: 'HomeView' })

const NodeCard = defineAsyncComponent(() => import('@/components/NodeCard.vue'))
const NodeGeneralCards = defineAsyncComponent(() => import('@/components/NodeGeneralCards.vue'))
const NodeList = defineAsyncComponent(() => import('@/components/NodeList.vue'))

const appStore = useAppStore()
const nodesStore = useNodesStore()
const router = useRouter()

onActivated(() => {
  if (appStore.homeScrollPosition > 0) {
    nextTick(() => {
      window.scrollTo({ top: appStore.homeScrollPosition, behavior: 'instant' })
    })
  }
})

onDeactivated(() => {
  appStore.homeScrollPosition = window.scrollY
})

const searchText = ref('')
const debouncedSearchText = ref('')

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearchText.value = value
}, 300)

watch(searchText, (value) => {
  updateDebouncedSearch(value)
})

const groups = computed(() => [
  { tab: '全部节点', name: 'all' },
  ...nodesStore.groups.map(g => ({ tab: g, name: g })),
])

watch(
  () => nodesStore.groups,
  (gs) => {
    const cur = appStore.nodeSelectedGroup
    if (cur !== 'all' && !gs.includes(cur)) {
      appStore.nodeSelectedGroup = 'all'
    }
  },
  { immediate: true },
)

function isNodeMatchSearch(node: typeof nodesStore.nodes[number], search: string): boolean {
  if (!search.trim())
    return true
  const lowerSearch = search.toLowerCase().trim()
  if (node.name.toLowerCase().includes(lowerSearch))
    return true
  if (node.region && isRegionMatch(node.region, search))
    return true
  if (node.os && node.os.toLowerCase().includes(lowerSearch))
    return true
  if (node.group && node.group.toLowerCase().includes(lowerSearch))
    return true
  if (node.tags && node.tags.toLowerCase().includes(lowerSearch))
    return true
  if (node.remark && node.remark.toLowerCase().includes(lowerSearch))
    return true
  return false
}

const nodeList = computed(() => {
  let filtered = appStore.nodeSelectedGroup === 'all'
    ? nodesStore.nodes
    : nodesStore.nodes.filter(n => n.group === appStore.nodeSelectedGroup)
  if (debouncedSearchText.value.trim()) {
    filtered = filtered.filter(n => isNodeMatchSearch(n, debouncedSearchText.value))
  }
  return filtered
})

function handleNodeClick(node: typeof nodesStore.nodes[number]) {
  router.push({ name: 'instance-detail', params: { id: node.uuid } })
}
</script>

<template>
  <div class="home-view">
    <div v-if="appStore.connectionError" class="alert px-4">
      <Alert variant="destructive" class="border-none backdrop-blur-xs bg-red-400/10 rounded-md">
        <AlertTitle>RPC 服务错误</AlertTitle>
        <AlertDescription>连接服务器失败，请检查网络设置或刷新页面后再试。</AlertDescription>
      </Alert>
    </div>

    <div v-if="appStore.alertEnabled && appStore.alertContent" class="alert px-4">
      <Alert class="border-none bg-background/60 backdrop-blur-xs rounded-md">
        <AlertTitle v-if="appStore.alertTitle">
          {{ appStore.alertTitle }}
        </AlertTitle>
        <AlertDescription>
          <MarkdownRenderer :content="appStore.alertContent" />
        </AlertDescription>
      </Alert>
    </div>

    <NodeGeneralCards />

    <div class="node-info p-4 pt-0 flex flex-col gap-4 relative z-1 pointer-events-none">
      <div class="nodes">
        <Tabs v-model="appStore.nodeSelectedGroup" class="w-full flex-col gap-4">
          <div class="flex gap-2 items-center flex-nowrap">
            <div class="overflow-x-auto rounded-sm">
              <TabsList class="h-8 bg-background/50 backdrop-blur-xl pointer-events-auto rounded-md">
                <TabsTrigger
                  v-for="g in groups" :key="g.name" :value="g.name"
                  class="h-6.5 text-xs border-none data-[state=active]:text-green-600 shadow-none rounded-sm"
                >
                  {{ g.tab }}
                </TabsTrigger>
              </TabsList>
            </div>
            <div class="flex-1" />
            <div class="search flex gap-2 items-center pointer-events-auto">
              <Button
                variant="outline" size="icon" aria-label="卡片视图"
                class="w-8 h-8 border-none  bg-background/50 backdrop-blur-xs shadow-none hover:bg-background/60 rounded-md"
                :class="[appStore.nodeViewMode === 'card' ? '!text-green-600 !bg-background' : '']"
                @click="appStore.nodeViewMode = 'card'"
              >
                <Icon icon="tabler:layout-grid" :width="14" :height="14" />
              </Button>
              <Button
                variant="outline" size="icon" aria-label="列表视图"
                class="w-8 h-8 border-none bg-background/50 backdrop-blur-xs shadow-none hover:bg-background/60 rounded-md"
                :class="[appStore.nodeViewMode === 'list' ? '!text-green-600 !bg-background' : '']"
                @click="appStore.nodeViewMode = 'list'"
              >
                <Icon icon="tabler:table" :width="14" :height="14" />
              </Button>
              <div class="relative z-1 w-8 h-8">
                <div class="absolute top-0 right-0 ">
                  <Input
                    v-model="searchText" placeholder="搜索节点名称、地区、系统"
                    class="transition-all placeholder:text-transparent border-none shadow-none w-8 h-8  bg-background/50 backdrop-blur-xs rounded-md hover:!bg-background/60 focus:!w-60 focus:!pl-7.5 focus:placeholder:!text-muted-foreground focus:!bg-background/80 focus:!ring-slate-500/10"
                  />
                  <Icon
                    icon="tabler:search" :width="14" :height="14"
                    class="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>
          <TabsContent v-for="g in groups" :key="g.name" :value="g.name" class="pointer-events-auto">
            <div
              v-if="nodeList.length !== 0 && appStore.nodeViewMode === 'card'"
              class="gap-2 grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]"
            >
              <NodeCard v-for="node in nodeList" :key="node.uuid" :node="node" @click="handleNodeClick(node)" />
            </div>
            <NodeList
              v-else-if="nodeList.length !== 0 && appStore.nodeViewMode === 'list'" :nodes="nodeList"
              @click="handleNodeClick"
            />
            <div v-else class="text-muted-foreground text-center py-8">
              <Empty description="暂无节点" />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>
