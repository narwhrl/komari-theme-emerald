import { cn } from '@/lib/utils'

export type ProgressStatus = 'success' | 'warning' | 'danger' | 'error' | 'normal'

const statusClass: Record<ProgressStatus, string> = {
  success: 'bg-emerald-600 dark:bg-emerald-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-600',
  error: 'bg-red-600',
  normal: 'bg-emerald-600 dark:bg-emerald-500',
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
  const scale = Math.min(Math.max(percentage, 0), 100) / 100
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height

  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-muted', className)} style={{ height: resolvedHeight }}>
      <div className={cn('h-full w-full origin-left rounded-full transition-transform duration-300 ease-out', statusClass[status])} style={{ transform: `scaleX(${scale})` }} />
    </div>
  )
}
