'use client'

import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import { cva } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const toggleGroupVariants = cva(
  'inline-flex items-center justify-center text-muted-foreground data-[orientation=vertical]:flex-col',
  {
    variants: {
      variant: {
        default: 'w-fit gap-0.5',
        outline: 'gap-0 overflow-hidden rounded-xl border border-input bg-popover shadow-xs/5 not-dark:bg-clip-padding dark:bg-input/32',
      },
      size: {
        default: '',
        sm: '',
        lg: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const toggleGroupItemVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-none transition-[background-color,color,box-shadow] duration-150 ease-out hover:text-foreground focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-disabled:pointer-events-none data-disabled:opacity-64 data-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'rounded-lg border-transparent text-foreground hover:bg-accent data-pressed:bg-input/64 data-pressed:text-accent-foreground',
        outline: 'rounded-none hover:bg-muted/60 data-pressed:bg-muted/80 dark:hover:bg-input/64 dark:data-pressed:bg-input/80',
      },
      size: {
        default: 'h-9 min-w-9 px-[calc(--spacing(2)-1px)] text-sm [&_svg:not([class*=\'size-\'])]:size-4 sm:h-8 sm:min-w-8',
        sm: 'h-8 min-w-8 px-2 text-xs [&_svg:not([class*=\'size-\'])]:size-3.5',
        lg: 'h-10 min-w-10 px-3 text-base [&_svg:not([class*=\'size-\'])]:size-4.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ToggleGroupVariant = NonNullable<VariantProps<typeof toggleGroupVariants>['variant']>
type ToggleGroupSize = NonNullable<VariantProps<typeof toggleGroupVariants>['size']>

const ToggleGroupContext = React.createContext<{
  variant: ToggleGroupVariant
  size: ToggleGroupSize
}>({
  variant: 'default',
  size: 'default',
})

export interface ToggleGroupProps
  extends ComponentProps<typeof ToggleGroupPrimitive>,
  VariantProps<typeof toggleGroupVariants> {}

export function ToggleGroup({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ToggleGroupProps): ReactElement {
  const resolvedVariant = variant ?? 'default'
  const resolvedSize = size ?? 'default'

  return (
    <ToggleGroupContext value={{ variant: resolvedVariant, size: resolvedSize }}>
      <ToggleGroupPrimitive
        className={cn(toggleGroupVariants({ variant: resolvedVariant, size: resolvedSize, className }))}
        data-slot="toggle-group"
        {...props}
      />
    </ToggleGroupContext>
  )
}

export interface ToggleGroupItemProps
  extends ComponentProps<typeof TogglePrimitive>,
  VariantProps<typeof toggleGroupItemVariants> {}

export function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: ToggleGroupItemProps): ReactElement {
  const context = React.use(ToggleGroupContext)

  return (
    <TogglePrimitive
      className={cn(
        toggleGroupItemVariants({
          variant: variant ?? context.variant,
          size: size ?? context.size,
          className,
        }),
      )}
      data-slot="toggle-group-item"
      {...props}
    />
  )
}

export interface ToggleGroupSeparatorProps extends ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical'
}

export function ToggleGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: ToggleGroupSeparatorProps): ReactElement {
  return (
    <div
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'vertical' ? 'h-9 w-px' : 'h-px w-9',
        className,
      )}
      data-orientation={orientation}
      data-slot="toggle-group-separator"
      role="separator"
      {...props}
    />
  )
}
