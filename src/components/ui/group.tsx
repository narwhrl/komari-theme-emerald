'use client'

import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@/lib/utils'

export function Group({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return (
    <div
      className={cn(
        'inline-flex h-9 w-fit items-stretch overflow-hidden rounded-xl border border-input bg-popover text-foreground shadow-xs/5 not-dark:bg-clip-padding dark:bg-input/32',
        '[&>button]:!h-auto [&>button]:!rounded-none [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:!shadow-none [&>button]:not-dark:!bg-transparent [&>button]:dark:!bg-transparent',
        '[&>button]:px-3 [&>button]:text-muted-foreground [&>button]:hover:!bg-muted/60 [&>button]:hover:text-foreground [&>button]:focus-visible:z-1',
        '[&>button[aria-pressed=true]]:!bg-muted/80 [&>button[aria-pressed=true]]:text-foreground [&>button[aria-pressed=true]]:dark:!bg-input/80',
        className,
      )}
      data-slot="group"
      role="group"
      {...props}
    />
  )
}

export interface GroupSeparatorProps extends ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical'
}

export function GroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: GroupSeparatorProps): ReactElement {
  return (
    <div
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'vertical' ? 'w-px self-stretch' : 'h-px w-full',
        className,
      )}
      data-orientation={orientation}
      data-slot="group-separator"
      role="separator"
      {...props}
    />
  )
}
