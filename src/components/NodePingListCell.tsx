'use client'

import { DataTooltip } from '@/components/ui/tooltip'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'

export default function NodePingListCell({ uuid }: { uuid: string, online: boolean }) {
  const { latencyRenderBars, lossRenderBars } = useNodePingDisplay(uuid)

  const renderBars = (bars: typeof latencyRenderBars) => (
    <div
      className="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
      style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
    >
      {bars.map(bar => (
        <DataTooltip key={bar.key} placement="top" content={bar.tooltip} className="h-full w-full">
          <span className={`block h-full w-full rounded-[1px] transition-all group-hover:opacity-50 hover:scale-y-160 hover:opacity-100 ${bar.className}`} />
        </DataTooltip>
      ))}
    </div>
  )

  return (
    <div className="group flex flex-col gap-[1px] pr-4">
      <div className="group/panel relative items-center gap-1 opacity-80 hover:opacity-100">
        {renderBars(latencyRenderBars)}
      </div>
      <div className="group/panel relative items-center gap-1 opacity-80 hover:opacity-100">
        {renderBars(lossRenderBars)}
      </div>
    </div>
  )
}
