<script setup lang="ts">
import type { Arc, COBEOptions, Globe, Marker } from 'cobe'
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import {
  useDocumentVisibility,
  useElementSize,
  useElementVisibility,
  useRafFn,
} from '@vueuse/core'
import createGlobe from 'cobe'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getCoordByCode, getCountryCodeFromRegion } from '@/utils/geoHelper'
import { formatBytesPerSecondSplit } from '@/utils/helper'

const props = defineProps<{
  nodes?: NodeData[]
}>()
const appStore = useAppStore()
const nodesStore = useNodesStore()

const displayNodes = computed(() => props.nodes ?? nodesStore.nodes)

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const { width: containerWidth, height: containerHeight } = useElementSize(containerRef)

const documentVisibility = useDocumentVisibility()
const elementVisible = useElementVisibility(containerRef)
const shouldRender = computed(() => documentVisibility.value === 'visible' && elementVisible.value)
const shouldAutoRotate = computed(() => appStore.earthViewMode !== 'earth-stop')

let globe: Globe | null = null
const INITIAL_THETA = 0.22
const MIN_THETA = -0.65
const MAX_THETA = 0.65
const CHINA_COORD = getCoordByCode('CN') ?? [35.8617, 104.1954]
const DEFAULT_PHI = normalizePhi(-Math.PI / 2 - CHINA_COORD[1] * Math.PI / 180)
let phi = DEFAULT_PHI
let targetPhi = phi
let theta = INITIAL_THETA
let targetTheta = INITIAL_THETA
let isPointerDown = false
let lastPointerX = 0
let lastPointerY = 0
let staticRedrawUntil = 0

function normalizePhi(value: number): number {
  const circle = Math.PI * 2
  let next = value % circle
  if (next <= -Math.PI)
    next += circle
  if (next > Math.PI)
    next -= circle
  return next
}

function clampTheta(value: number): number {
  return Math.min(Math.max(value, MIN_THETA), MAX_THETA)
}

function resetStoppedView() {
  phi = DEFAULT_PHI
  targetPhi = DEFAULT_PHI
  theta = INITIAL_THETA
  targetTheta = INITIAL_THETA
}

function triggerStaticRedrawWindow(duration = 1500) {
  if (typeof performance === 'undefined') {
    staticRedrawUntil = Date.now() + duration
    return
  }
  staticRedrawUntil = performance.now() + duration
}

function shouldKeepStaticRedraw(): boolean {
  const now = typeof performance === 'undefined' ? Date.now() : performance.now()
  return now < staticRedrawUntil
}

// 减少高采样导致的性能问题
function getCappedDpr(): number {
  if (typeof window === 'undefined')
    return 1.5
  const raw = window.devicePixelRatio || 1
  return Math.min(Math.max(raw, 1.5), 2)
}

interface RegionCluster {
  code: string
  coord: [number, number]
  servers: number
  onlineServers: number
}

function clusterKey(c: RegionCluster) {
  return `${c.code}:${c.servers}:${c.onlineServers}`
}

// 节点按地区聚合
const regionClusters = computed<RegionCluster[]>(() => {
  const map = new Map<string, RegionCluster>()
  for (const node of displayNodes.value) {
    const code = getCountryCodeFromRegion(node.region)
    if (!code)
      continue
    const coord = getCoordByCode(code)
    if (!coord)
      continue

    let entry = map.get(code)
    if (!entry) {
      entry = { code, coord, servers: 0, onlineServers: 0 }
      map.set(code, entry)
    }
    entry.servers += 1
    if (node.online)
      entry.onlineServers += 1
  }
  return Array.from(map.values()).sort((a, b) => b.servers - a.servers)
})

interface RegionRate {
  up: number
  down: number
}

const regionRates = computed<Map<string, RegionRate>>(() => {
  const map = new Map<string, RegionRate>()
  for (const node of displayNodes.value) {
    if (!node.online)
      continue
    const code = getCountryCodeFromRegion(node.region)
    if (!code)
      continue
    let entry = map.get(code)
    if (!entry) {
      entry = { up: 0, down: 0 }
      map.set(code, entry)
    }
    entry.up += node.net_out || 0
    entry.down += node.net_in || 0
  }
  return map
})

function markerId(code: string): string {
  return `cdn-${code.toLowerCase()}`
}

// 挂载 marker
const anchorRefs = shallowRef<ReadonlyMap<string, HTMLDivElement>>(new Map())

function getAnchorEl(code: string): HTMLDivElement | undefined {
  return anchorRefs.value.get(markerId(code))
}

// 容器尺寸缓存
let cachedContainerW = 0
let cachedContainerH = 0
function refreshContainerSizeCache() {
  cachedContainerW = containerWidth.value || canvasRef.value?.clientWidth || 320
  cachedContainerH = containerHeight.value || canvasRef.value?.clientHeight || cachedContainerW
}

const patchedAnchors = new WeakSet<HTMLElement>()

interface AnchorCtx {
  xPx: number
  yPx: number
}
const anchorCtxs = new WeakMap<HTMLDivElement, AnchorCtx>()
const dirtyAnchors = new Set<HTMLDivElement>()

// 批量 flush 锚点位置
function flushDirtyAnchors() {
  if (dirtyAnchors.size === 0)
    return
  for (const el of dirtyAnchors) {
    const ctx = anchorCtxs.get(el)
    if (ctx)
      el.style.transform = `translate3d(${ctx.xPx}px, ${ctx.yPx}px, 0)`
  }
  dirtyAnchors.clear()
}

// 锚点定位改为性能更优、支持 GPU 加速的 transform
// 异常回落到 cobe 默认行为
function patchAnchorTransform(el: HTMLDivElement) {
  if (patchedAnchors.has(el))
    return
  refreshContainerSizeCache()
  const ctx: AnchorCtx = {
    xPx: ((Number.parseFloat(el.style.left) || 0) / 100) * cachedContainerW,
    yPx: ((Number.parseFloat(el.style.top) || 0) / 100) * cachedContainerH,
  }
  anchorCtxs.set(el, ctx)
  el.style.left = '0px'
  el.style.top = '0px'
  el.style.transform = `translate3d(${ctx.xPx}px, ${ctx.yPx}px, 0)`
  el.style.willChange = 'transform'
  try {
    Object.defineProperty(el.style, 'left', {
      configurable: true,
      enumerable: true,
      get() { return '0px' },
      set(v: string) {
        const next = ((Number.parseFloat(v) || 0) / 100) * cachedContainerW
        if (next === ctx.xPx)
          return
        ctx.xPx = next
        dirtyAnchors.add(el)
      },
    })
    Object.defineProperty(el.style, 'top', {
      configurable: true,
      enumerable: true,
      get() { return '0px' },
      set(v: string) {
        const next = ((Number.parseFloat(v) || 0) / 100) * cachedContainerH
        if (next === ctx.yPx)
          return
        ctx.yPx = next
        dirtyAnchors.add(el)
      },
    })
    patchedAnchors.add(el)
  }
  catch (err) {
    console.warn('[NodeEarthGlobe] anchor transform patch failed, falling back to cobe default', err)
  }
}

function patchAllAnchors() {
  if (!canvasRef.value)
    return
  const wrapper = canvasRef.value.parentElement
  if (!wrapper)
    return
  const anchors = wrapper.querySelectorAll<HTMLDivElement>('div[style*="--cobe-"]')
  anchors.forEach(patchAnchorTransform)
}

// hook wrapper.append：在 cobe 写入新锚点的第一个 left/top 之前完成 patch
const COBE_HOOK_FLAG = Symbol('cobeAppendHooked')
type HookableWrapper = HTMLElement & { [COBE_HOOK_FLAG]?: boolean }

function hookWrapperAppend() {
  if (!canvasRef.value)
    return
  const wrapper = canvasRef.value.parentElement as HookableWrapper | null
  if (!wrapper || wrapper[COBE_HOOK_FLAG])
    return
  wrapper[COBE_HOOK_FLAG] = true
  const origAppend = wrapper.append.bind(wrapper)
  wrapper.append = (...nodes: (Node | string)[]) => {
    const ret = origAppend(...nodes)
    for (const node of nodes) {
      if (node instanceof HTMLDivElement && node.style.cssText.includes('--cobe-'))
        patchAnchorTransform(node)
    }
    return ret
  }
}

function syncAnchorRefs() {
  if (!canvasRef.value) {
    anchorRefs.value = new Map()
    return
  }
  const wrapper = canvasRef.value.parentElement
  if (!wrapper) {
    anchorRefs.value = new Map()
    return
  }
  const next = new Map<string, HTMLDivElement>()
  for (const cluster of regionClusters.value) {
    const id = markerId(cluster.code)
    const el = wrapper.querySelector<HTMLDivElement>(`div[style*="--cobe-${id}"]`)
    if (el)
      next.set(id, el)
  }
  anchorRefs.value = next
}

const markers = computed<Marker[]>(() => {
  return regionClusters.value.map(cluster => ({
    id: markerId(cluster.code),
    location: cluster.coord,
    size: 0, // 不渲染圆点
  }))
})

// 以服务器数最多的地区为中心，向其余地区连线，形成 CDN 拓扑
const arcs = computed<Arc[]>(() => {
  const clusters = regionClusters.value
  if (clusters.length < 2)
    return []
  const hub = clusters[0]
  if (!hub)
    return []
  return clusters.slice(1).map(cluster => ({
    from: hub.coord,
    to: cluster.coord,
  }))
})

const themeColors = computed(() => {
  if (appStore.isDark) {
    return {
      dark: 1,
      mapBrightness: 4,
      baseColor: [0.32, 0.33, 0.4] as [number, number, number],
      markerColor: [0.4, 0.7, 1.0] as [number, number, number],
      glowColor: [0.2, 0.25, 0.45] as [number, number, number],
      arcColor: [0.45, 0.75, 1.0] as [number, number, number],
    }
  }
  return {
    dark: 0,
    mapBrightness: 6,
    baseColor: [1, 1, 1] as [number, number, number],
    markerColor: [0.21, 0.51, 0.93] as [number, number, number],
    glowColor: [1, 1, 1] as [number, number, number],
    arcColor: [0.21, 0.51, 0.93] as [number, number, number],
  }
})

function getRenderSize() {
  const width = containerWidth.value || canvasRef.value?.clientWidth || 320
  const height = containerHeight.value || canvasRef.value?.clientHeight || width
  return { width, height }
}

function buildInitialOptions(): COBEOptions {
  const colors = themeColors.value
  const { width, height } = getRenderSize()
  return {
    devicePixelRatio: getCappedDpr(),
    width,
    height,
    phi,
    theta,
    dark: colors.dark,
    diffuse: 1.2,
    mapSamples: 10000, // 地图采样点数，默认 16000
    mapBrightness: colors.mapBrightness,
    baseColor: colors.baseColor,
    markerColor: colors.markerColor,
    glowColor: colors.glowColor,
    markers: markers.value,
    arcs: arcs.value,
    arcColor: colors.arcColor,
    arcWidth: 0.75,
    arcHeight: 0.3,
    markerElevation: 0,
  }
}

function updateGlobeFrame(forceSyncAnchors = false) {
  if (!globe)
    return
  refreshContainerSizeCache()
  const { width, height } = getRenderSize()
  globe.update({ phi, theta, width, height })
  if (forceSyncAnchors)
    syncAnchorRefs()
  flushDirtyAnchors()
}

// phi 收敛/静止时整帧跳过 globe.update，WebGL + 锚点写入双双归零
const ORIENTATION_IDLE_EPSILON = 1e-5
const { pause: pauseRaf, resume: resumeRaf } = useRafFn(
  () => {
    if (!globe)
      return
    const prevPhi = phi
    const prevTheta = theta
    if (!isPointerDown && shouldAutoRotate.value)
      targetPhi += 0.0025
    phi += (targetPhi - phi) * 1
    theta += (targetTheta - theta) * 1
    if (
      Math.abs(phi - prevPhi) < ORIENTATION_IDLE_EPSILON
      && Math.abs(theta - prevTheta) < ORIENTATION_IDLE_EPSILON
    ) {
      if (!shouldAutoRotate.value && shouldKeepStaticRedraw()) {
        updateGlobeFrame(true)
      }
      return
    }
    updateGlobeFrame()
  },
  { immediate: false /* fpsLimit: 60 */ },
)

function startGlobe() {
  if (!canvasRef.value)
    return
  if (appStore.earthViewMode === 'earth-stop') {
    resetStoppedView()
    triggerStaticRedrawWindow()
  }
  globe = createGlobe(canvasRef.value, buildInitialOptions())
  refreshContainerSizeCache()
  hookWrapperAppend()
  patchAllAnchors()
  syncAnchorRefs()
  // 静止地球没有自转帧，首帧需要在实际尺寸稳定后主动重绘一次。
  requestAnimationFrame(() => {
    updateGlobeFrame(true)
  })
  // documentVisibility 同步可读；useElementVisibility 需等 IntersectionObserver 首回调
  // 先按"前台"启动，若实际不可见，shouldRender 的 watch 会在下一帧 pause
  if (documentVisibility.value === 'visible')
    resumeRaf()
}

// 必须先清空 anchorRefs 让 Teleport 把 marker 移回 wrapper，再 destroy；
// 否则 destroy 时锚点 div 被移除会连带 marker 一起被剥离。
// cobe 也不会清理自己创建的 wrapper Z，这里手动收尾。
async function stopGlobe() {
  pauseRaf()
  anchorRefs.value = new Map()
  await nextTick()
  globe?.destroy()
  globe = null
  if (canvasRef.value && containerRef.value) {
    const cobeWrapper = canvasRef.value.parentElement
    if (cobeWrapper && cobeWrapper !== containerRef.value) {
      containerRef.value.appendChild(canvasRef.value)
      cobeWrapper.remove()
    }
  }
}

async function rebuildGlobe() {
  await stopGlobe()
  startGlobe()
}

onMounted(() => {
  startGlobe()
})

onBeforeUnmount(() => {
  pauseRaf()
  globe?.destroy()
  globe = null
})

// 切换主题时重建 globe
watch(() => appStore.isDark, async () => {
  await rebuildGlobe()
})

watch(
  [containerWidth, containerHeight],
  ([width, height]) => {
    if (!globe || width <= 0 || height <= 0)
      return
    if (!shouldAutoRotate.value)
      triggerStaticRedrawWindow(600)
    updateGlobeFrame(true)
  },
)

watch(
  () => appStore.earthViewMode,
  (mode) => {
    if (mode === 'earth-stop')
      resetStoppedView()
    triggerStaticRedrawWindow()
    updateGlobeFrame(true)
  },
)

// 仅地区集合或在线状态变化时才推送 markers/arcs；速率推送不触发
watch(
  () => regionClusters.value.map(clusterKey).join(','),
  () => {
    if (!globe)
      return
    refreshContainerSizeCache()
    globe.update({ markers: markers.value, arcs: arcs.value })
    syncAnchorRefs()
    if (!shouldAutoRotate.value)
      triggerStaticRedrawWindow(600)
    // phi 静止时 RAF 跳帧会漏掉这次 flush，手动补一次
    flushDirtyAnchors()
  },
)

watch(shouldRender, (visible) => {
  if (!globe)
    return
  if (visible) {
    if (!shouldAutoRotate.value)
      triggerStaticRedrawWindow()
    resumeRaf()
  }
  else {
    pauseRaf()
  }
})

function onPointerDown(e: PointerEvent) {
  isPointerDown = true
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!isPointerDown)
    return
  const deltaX = e.clientX - lastPointerX
  const deltaY = e.clientY - lastPointerY
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  targetPhi += deltaX / 200
  targetTheta = clampTheta(targetTheta + deltaY / 300)
}
function onPointerUp(e: PointerEvent) {
  isPointerDown = false
  const target = e.currentTarget as HTMLElement
  if (target.hasPointerCapture(e.pointerId))
    target.releasePointerCapture(e.pointerId)
}

const totalServers = computed(() => displayNodes.value.length)
const onlineServers = computed(() => displayNodes.value.filter(node => node.online).length)
const offlineServers = computed(() => totalServers.value - onlineServers.value)

function rateFor(code: string): RegionRate {
  return regionRates.value.get(code) ?? { up: 0, down: 0 }
}

function formatRate(bytesPerSec: number): string {
  const { value, unit } = formatBytesPerSecondSplit(bytesPerSec, appStore.byteDecimals)
  return `${value} ${unit}`
}
</script>

<template>
  <div ref="containerRef" class="relative aspect-square w-full max-w-md mx-auto -translate-y-6 md:-translate-y-12">
    <canvas
      ref="canvasRef"
      class="earth-globe-canvas absolute inset-0 w-full h-full select-none touch-none cursor-grab active:cursor-grabbing"
      @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp"
    />

    <template v-for="cluster in regionClusters" :key="cluster.code">
      <Teleport :to="getAnchorEl(cluster.code) ?? containerRef!" :disabled="!getAnchorEl(cluster.code)">
        <div
          class="absolute -top-7.5 left-0 transition-[opacity,filter] duration-500 rounded backdrop-blur-[2px]"
          :style="{
            opacity: `var(--cobe-visible-${markerId(cluster.code)}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${markerId(cluster.code)}, 0)) * 20px))`,
          }"
        >
          <img
            :src="`/images/flags/${cluster.code}.svg`" :alt="cluster.code"
            class="size-4 block absolute -bottom-2 -left-2 z-1"
          >
          <div
            class="relative z-2 bg-background/60 rounded py-0.5 px-1 text-xs zoom-80 items-start justify-center text-nowrap"
          >
            <div class="text-green-600 flex flex-row items-center gap-0.5">
              <Icon icon="tabler:chevron-up" width="12" height="12" /> {{ formatRate(rateFor(cluster.code).up) }}
            </div>
            <div class="text-blue-600 flex flex-row items-center gap-0.5">
              <Icon icon="tabler:chevron-down" width="12" height="12" /> {{ formatRate(rateFor(cluster.code).down) }}
            </div>
          </div>
        </div>
      </Teleport>
    </template>

    <div
      v-if="totalServers > 0"
      class="absolute top-6 md:top-12 left-0 text-[10px] text-muted-foreground pointer-events-none flex gap-2 items-center backdrop-blur-lg bg-background/60 rounded px-2 py-0.5"
    >
      <div v-if="onlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 rounded-full bg-green-600 animate-pulse" />
        <span class="text-green-600">{{ onlineServers }}</span>
      </div>
      <div v-if="offlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 rounded-full bg-yellow-600 animate-pulse" />
        <span class="text-yellow-600">{{ offlineServers }}</span>
      </div>
      <!-- <div v-if="totalServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 rounded-full bg-blue-600 animate-pulse" />
        <span class="text-blue-600">{{ totalServers }}</span>
      </div> -->
    </div>
  </div>
</template>

<style scoped>
.earth-globe-canvas {
  contain: layout paint;
}
</style>
