import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-[0_1px_0_color-mix(in_oklab,var(--color-border)_75%,transparent)]',
        className,
      )}
      {...props}
    />
  )
}
