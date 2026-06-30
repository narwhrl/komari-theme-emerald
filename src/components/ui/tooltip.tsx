'use client'

import type { ComponentProps, ElementType, ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { createElement } from 'react'
import { cn } from '@/lib/utils'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider>{children}</TooltipPrimitive.Provider>
}

export function DataTooltip({
  children,
  content,
  className,
  contentClass,
  placement = 'top',
  as = 'div',
}: {
  children: ReactNode
  content?: ReactNode
  className?: string
  contentClass?: string
  placement?: ComponentProps<typeof TooltipPrimitive.Positioner>['side']
  as?: ElementType
}) {
  const TriggerTag = as

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={250} render={createElement(TriggerTag, { className })}>
        {children}
      </TooltipPrimitive.Trigger>
      {content
        ? (
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Positioner side={placement} sideOffset={6} className="z-50">
                <TooltipPrimitive.Popup
                  className={cn(
                    'max-w-xs rounded-md bg-foreground px-2 py-1 text-xs whitespace-pre-line text-background shadow-md',
                    contentClass,
                  )}
                >
                  {content}
                  <TooltipPrimitive.Arrow className="fill-foreground" />
                </TooltipPrimitive.Popup>
              </TooltipPrimitive.Positioner>
            </TooltipPrimitive.Portal>
          )
        : null}
    </TooltipPrimitive.Root>
  )
}
