'use client'

import type { ComponentProps } from 'react'
import { Input as BaseInput } from '@base-ui/react/input'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<typeof BaseInput>) {
  return (
    <BaseInput
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground/72 selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs/5 outline-none transition-shadow file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium not-dark:bg-clip-padding disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 dark:bg-input/32',
        className,
      )}
      {...props}
    />
  )
}
