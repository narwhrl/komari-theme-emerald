import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function CardX({
  className,
  header,
  headerExtra,
  children,
  hoverable,
  ...props
}: ComponentProps<'div'> & {
  header?: ReactNode
  headerExtra?: ReactNode
  hoverable?: boolean
}) {
  return (
    <div
      className={cn(
        'vercel-card rounded-lg text-card-foreground',
        hoverable && 'motion-card hover:border-foreground/15 hover:bg-card hover:shadow-md',
        className,
      )}
      {...props}
    >
      {(header || headerExtra)
        ? (
            <div className="flex items-center justify-between gap-3 p-4 pb-2">
              <div className="min-w-0 flex-1">{header}</div>
              {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
            </div>
          )
        : null}
      <div className="p-4">{children}</div>
    </div>
  )
}
