import { cn } from '@/lib/utils'

export type ProgressStatus = 'success' | 'warning' | 'danger' | 'error' | 'normal'

const statusClass: Record<ProgressStatus, string> = {
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  danger: 'bg-red-600',
  error: 'bg-red-600',
  normal: 'bg-green-600',
}

export function ProgressThin({
  percentage,
  status = 'normal',
  height = 4,
  className,
}: {
  percentage: number
  status?: ProgressStatus
  height?: number | string
  className?: string
}) {
  const width = `${Math.min(Math.max(percentage, 0), 100)}%`
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height

  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-muted', className)} style={{ height: resolvedHeight }}>
      <div className={cn('h-full rounded-full transition-all', statusClass[status])} style={{ width }} />
    </div>
  )
}
