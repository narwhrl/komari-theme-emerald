import { Icon } from '@iconify/react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Icon icon="lucide:loader-circle" width={18} height={18} className={cn('animate-spin', className)} />
}
