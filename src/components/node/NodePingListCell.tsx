"use client";

import { useNodePingDisplay } from "@/hooks/useNodePingDisplay";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NodePingListCellProps {
  uuid: string;
  online: boolean;
}

export function NodePingListCell({ uuid }: NodePingListCellProps) {
  const { latencyRenderBars, lossRenderBars } = useNodePingDisplay(uuid);

  return (
    <div className="group flex flex-col gap-[1px] pr-4">
      <div className="relative items-center gap-1 opacity-80 hover:opacity-100 group/panel">
        <div
          className="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
          style={{ gridTemplateColumns: `repeat(${latencyRenderBars.length}, minmax(0, 1fr))` }}
        >
          {latencyRenderBars.map((bar) => (
            <Tooltip key={bar.key}>
              <TooltipTrigger>
                <span
                  className={`block h-full w-full rounded-[1px] transition-all group-hover:opacity-50 hover:scale-y-160 hover:opacity-100 ${bar.className}`}
                />
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line text-[11px] px-2">
                {bar.tooltip}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="relative items-center gap-1 opacity-80 hover:opacity-100 group/panel">
        <div
          className="grid h-1 cursor-auto items-end gap-[1px] transition-all hover:h-2.5"
          style={{ gridTemplateColumns: `repeat(${lossRenderBars.length}, minmax(0, 1fr))` }}
        >
          {lossRenderBars.map((bar) => (
            <Tooltip key={bar.key}>
              <TooltipTrigger>
                <span
                  className={`block h-full w-full rounded-[1px] transition-all group-hover:opacity-50 hover:scale-y-160 hover:opacity-100 ${bar.className}`}
                />
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line text-[11px] px-2">
                {bar.tooltip}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NodePingListCell;