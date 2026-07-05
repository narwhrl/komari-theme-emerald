import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-xl border px-3.5 py-3 text-sm text-card-foreground',
  {
    variants: {
      variant: {
        default: 'bg-transparent dark:bg-input/32',
        destructive: 'border-destructive/32 bg-destructive/4 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface AlertProps
  extends ComponentProps<'div'>,
  VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div className={cn(alertVariants({ variant, className }))} role="alert" {...props} />
}

export function AlertTitle({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-1 font-medium leading-none tracking-normal', className)} {...props} />
}

export function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('text-muted-foreground text-sm [&_p]:leading-relaxed', className)} {...props} />
}

export function AlertAction({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-3 flex justify-end', className)} {...props} />
}
