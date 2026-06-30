'use client'

/* eslint-disable node/prefer-global/process */

import type { VersionInfo } from '@/utils/api'
import { useEffect, useState } from 'react'
import { DataTooltip } from '@/components/ui/tooltip'
import VisitorInfoCard from '@/components/VisitorInfoCard'
import { useAppDerived } from '@/stores/app'
import { getSharedApi } from '@/utils/api'

const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '0.0.0'
const buildGitHash = process.env.NEXT_PUBLIC_BUILD_GIT_HASH ?? 'unknown'

export default function Footer() {
  const derived = useAppDerived()
  const [serverVersion, setServerVersion] = useState<VersionInfo | null>(null)

  useEffect(() => {
    getSharedApi().getVersion().then(setServerVersion).catch(() => {})
  }, [])

  const showIcp = derived.icpEnabled && derived.icpNumber
  const showPolice = derived.policeEnabled && derived.policeNumber
  const showFiling = showIcp || showPolice

  return (
    <>
      {derived.visitorInfoCardEnabled ? <VisitorInfoCard /> : null}
      <footer className="mx-auto w-full max-w-[1280px] p-4 sm:flex-row sm:gap-4">
        <div className="flex flex-row items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            Powered by
            <DataTooltip as="span" placement="top" content={serverVersion?.version ?? ''}>
              <a
                href="https://github.com/komari-monitor/komari"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80"
              >
                <span className="font-medium text-foreground">Komari Monitor</span>
              </a>
            </DataTooltip>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            Theme by
            <DataTooltip as="span" placement="top" content={`v${buildVersion}\n${buildGitHash}`}>
              <a
                href="https://github.com/Tokinx/komari-theme-emerald"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80"
              >
                <span className="font-medium text-foreground">Komari Emerald</span>
              </a>
            </DataTooltip>
          </div>
        </div>

        {showFiling
          ? (
              <div className="flex flex-wrap items-center justify-center gap-2 pb-7 sm:flex-shrink-0">
                {showIcp
                  ? (
                      <a href={derived.icpUrl} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-70">
                        <span className="text-xs text-muted-foreground">{derived.icpNumber}</span>
                      </a>
                    )
                  : null}
                {showIcp && showPolice ? <span className="text-xs text-muted-foreground opacity-50">·</span> : null}
                {showPolice
                  ? (
                      derived.policeUrl
                        ? (
                            <a href={derived.policeUrl} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-70">
                              <span className="text-xs text-muted-foreground">{derived.policeNumber}</span>
                            </a>
                          )
                        : (
                            <span className="text-xs text-muted-foreground">{derived.policeNumber}</span>
                          )
                    )
                  : null}
              </div>
            )
          : null}
      </footer>
    </>
  )
}
