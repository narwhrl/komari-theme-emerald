<script setup lang="ts">
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'

const props = defineProps<{
  uuid: string
  online: boolean
}>()

const {
  latencyRenderBars,
  lossRenderBars,
} = useNodePingDisplay(() => props.uuid)
</script>

<template>
  <div class="group flex flex-col gap-[1px] pr-4">
    <div class="group/panel relative items-center gap-1 opacity-80 hover:opacity-100">
      <div
        class="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
        :style="{ gridTemplateColumns: `repeat(${latencyRenderBars.length}, minmax(0, 1fr))` }"
      >
        <span
          v-for="bar in latencyRenderBars"
          :key="bar.key"
          class="group/bar relative h-full w-full"
        >
          <span class="block h-full w-full rounded-[1px] transition-all group-hover:opacity-50 hover:scale-y-160 hover:opacity-100" :class="bar.className" />
          <span
            class="pointer-events-none absolute bottom-full left-1/2 z-20 hidden mb-2 -translate-x-1/2 whitespace-wrap rounded bg-foreground/80 p-1 text-[10px] leading-none text-background shadow-lg group-hover/bar:block after:content-[attr(data-tooltip)]"
            :data-tooltip="bar.tooltip"
          />
        </span>
      </div>
    </div>
    <div class="group/panel relative items-center gap-1 opacity-80 hover:opacity-100">
      <div
        class="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
        :style="{ gridTemplateColumns: `repeat(${lossRenderBars.length}, minmax(0, 1fr))` }"
      >
        <span
          v-for="bar in lossRenderBars"
          :key="bar.key"
          class="group/bar relative h-full w-full"
        >
          <span class="block h-full w-full rounded-[1px] transition-all group-hover:opacity-50 hover:scale-y-160 hover:opacity-100" :class="bar.className" />
          <span
            class="pointer-events-none absolute bottom-full left-1/2 z-20 hidden mb-2 -translate-x-1/2 whitespace-wrap rounded bg-foreground/80 p-1 text-[10px] leading-none text-background shadow-lg group-hover/bar:block after:content-[attr(data-tooltip)]"
            :data-tooltip="bar.tooltip"
          />
        </span>
      </div>
    </div>
  </div>
</template>
