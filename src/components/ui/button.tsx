'use client'

import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'border border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'border border-destructive bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline: 'border border-border bg-background shadow-xs hover:border-foreground/20 hover:bg-accent hover:text-accent-foreground',
        secondary: 'border border-border bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'border border-transparent hover:border-border hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        'default': 'h-9 px-4 py-2',
        'sm': 'h-8 rounded-md px-3 text-xs',
        'lg': 'h-10 rounded-md px-6',
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
