import type { ReactNode } from 'react'
import { Icon } from '@iconify/react'
import { cn } from '@/lib/utils'

export function Empty({
  description = '暂无数据',
  children,
  className,
}: {
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground', className)}>
      <Icon icon="lucide:inbox" width={28} height={28} className="opacity-60" />
      <div className="text-sm">{description}</div>
      {children}
    </div>
  )
}
