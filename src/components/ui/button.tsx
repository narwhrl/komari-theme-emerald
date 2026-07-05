'use client'

import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90 data-pressed:bg-primary/90 disabled:shadow-none',
        destructive: 'border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90 data-pressed:bg-destructive/90 disabled:shadow-none',
        outline: 'border-input bg-popover text-foreground shadow-xs/5 not-dark:bg-clip-padding hover:bg-accent/50 data-pressed:bg-accent/50 dark:bg-input/32 dark:hover:bg-input/64',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 data-pressed:bg-secondary/90',
        ghost: 'border-transparent text-foreground hover:bg-accent data-pressed:bg-accent',
        link: 'border-transparent text-foreground underline-offset-4 hover:underline data-pressed:underline',
      },
      size: {
        'default': 'h-9 px-4 py-2',
        'sm': 'h-8 gap-1.5 px-3 text-xs',
        'lg': 'h-10 px-6',
        'icon': 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ComponentProps<typeof BaseButton>,
  VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <BaseButton
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
