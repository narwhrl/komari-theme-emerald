'use client'

import type { ComponentProps } from 'react'
import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar'
import { cn } from '@/lib/utils'

export function Avatar({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)} {...props} />
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full object-cover', className)} {...props} />
}

export function AvatarFallback({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn('bg-muted flex size-full items-center justify-center rounded-full text-sm font-medium', className)}
      {...props}
    />
  )
}

export function AvatarGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex -space-x-2', className)} {...props} />
}

export function AvatarBadge({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('absolute right-0 bottom-0 size-2 rounded-full bg-emerald-600 ring-2 ring-background dark:bg-emerald-400', className)} {...props} />
}

export function AvatarGroupCount({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('flex size-8 items-center justify-center rounded-full bg-muted text-xs', className)} {...props} />
}
