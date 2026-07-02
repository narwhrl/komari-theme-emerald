import { formatBytes } from '@/utils/helper'

export interface TrafficProgressProps {
  upload: number
  download: number
  trafficLimit: number
  trafficLimitType: 'up' | 'down' | 'min' | 'max' | 'sum'
  height?: number | string
  showIndicator?: boolean
}

export default function TrafficProgress({
  upload,
  download,
  trafficLimit,
  trafficLimitType,
  height,
  showIndicator = false,
}: TrafficProgressProps) {
  const showProgress = trafficLimit > 0
  const usedTraffic = (() => {
    switch (trafficLimitType) {
      case 'up': return upload
      case 'down': return download
      case 'min': return Math.min(upload, download)
      case 'max': return Math.max(upload, download)
      case 'sum':
      default: return upload + download
    }
  })()
  const totalPercentage = trafficLimit <= 0 ? 0 : Math.min((usedTraffic / trafficLimit) * 100, 100)
  const uploadPercentage = trafficLimit <= 0 ? 0 : Math.min((upload / trafficLimit) * 100, 100)
  const downloadPercentage = trafficLimit <= 0 ? 0 : Math.min((download / trafficLimit) * 100, 100)
  const totalScale = totalPercentage / 100
  const uploadScale = uploadPercentage / 100
  const downloadScale = downloadPercentage / 100
  const isDualColorMode = trafficLimitType === 'sum'
  const progressHeight = height === undefined ? undefined : typeof height === 'number' ? `${height}px` : height

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="relative overflow-hidden rounded-[5px] bg-muted transition-colors" style={{ height: progressHeight ?? '8px' }}>
        {isDualColorMode
          ? (
              <>
                <div className="absolute inset-y-0 left-0 w-full origin-left bg-emerald-600 transition-transform duration-300 ease-out dark:bg-emerald-500" style={{ transform: `scaleX(${uploadScale})` }} />
                <div className="absolute inset-y-0 left-0 w-full origin-left rounded-r-[5px] bg-blue-600 transition-transform duration-300 ease-out dark:bg-blue-500" style={{ transform: `translateX(${uploadPercentage}%) scaleX(${downloadScale})` }} />
              </>
            )
          : (
              <div className="absolute inset-y-0 left-0 w-full origin-left rounded-r-[5px] bg-emerald-600 transition-transform duration-300 ease-out dark:bg-emerald-500" style={{ transform: `scaleX(${totalScale})` }} />
            )}
      </div>
      {showIndicator && showProgress
        ? (
            <div className="flex items-center justify-between text-xs text-foreground/80">
              <span>
                {totalPercentage.toFixed(1)}
                %
              </span>
              <span className="text-muted-foreground">
                {formatBytes(usedTraffic)}
                {' '}
                /
                {' '}
                {formatBytes(trafficLimit)}
              </span>
            </div>
          )
        : null}
    </div>
  )
}
