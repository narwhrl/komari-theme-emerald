'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useAppDerived } from '@/stores/app'

const summarySkeletonItems = ['memory', 'disk', 'traffic']
const nodeSkeletonItems = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5', 'node-6', 'node-7', 'node-8']
const cardStaggerMs = 35

export default function LoadingCover() {
  const { isDark } = useAppDerived()

  return (
    <div
      role="status"
      aria-label="正在加载"
      className={`fixed inset-0 z-20 overflow-hidden backdrop-blur-[2px] ${isDark ? 'bg-background/74' : 'bg-background/82'}`}
    >
      <div className="mx-auto min-h-full max-w-[1280px] px-4 pt-18 pb-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-34 max-w-[45vw]" />
              <Skeleton className="h-2 w-56 max-w-[60vw] rounded-full opacity-70" />
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {summarySkeletonItems.map((item, index) => (
              <div
                key={item}
                className="motion-stagger-item min-w-0"
                style={{ animationDelay: `${index * cardStaggerMs}ms` }}
              >
                <SummarySkeletonCard />
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center gap-2 overflow-hidden rounded-sm">
            <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
            <Skeleton className="h-8 w-16 shrink-0 rounded-md opacity-80" />
            <Skeleton className="h-8 w-16 shrink-0 rounded-md opacity-70" />
            <Skeleton className="h-8 w-16 shrink-0 rounded-md opacity-60" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {nodeSkeletonItems.map((item, index) => (
              <div
                key={item}
                className="motion-stagger-item min-w-0"
                style={{ animationDelay: `${(index + summarySkeletonItems.length) * cardStaggerMs}ms` }}
              >
                <NodeSkeletonCard />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummarySkeletonCard() {
  return (
    <div className="vercel-card min-h-24 rounded-md bg-card/95 p-4">
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-18" />
          <Skeleton className="size-5 rounded-sm" />
        </div>
        <div className="flex items-end gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

function NodeSkeletonCard() {
  return (
    <div className="vercel-card rounded-md bg-card/95 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-40 max-w-[45vw]" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="size-4 rounded-sm" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-sm" />
        <Skeleton className="h-10 rounded-sm" />
      </div>
    </div>
  )
}

function MetricSkeleton() {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-11" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  )
}
