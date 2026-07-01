"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app";
import { getSharedApi, type VersionInfo } from "@/utils/api";
import { VisitorInfoCard } from "@/components/visitor/VisitorInfoCard";

const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
const buildGitHash = process.env.NEXT_PUBLIC_BUILD_GIT_HASH ?? "local";

export function Footer() {
  const visitorInfoCardEnabled = useAppStore((s) => s.getVisitorInfoCardEnabled());
  const icpEnabled = useAppStore((s) => s.getIcpEnabled());
  const icpNumber = useAppStore((s) => s.getIcpNumber());
  const icpUrl = useAppStore((s) => s.getIcpUrl());
  const policeEnabled = useAppStore((s) => s.getPoliceEnabled());
  const policeNumber = useAppStore((s) => s.getPoliceNumber());
  const policeUrl = useAppStore((s) => s.getPoliceUrl());

  const [serverVersion, setServerVersion] = useState<VersionInfo | null>(null);
  useEffect(() => {
    getSharedApi()
      .getVersion()
      .then((v) => setServerVersion(v))
      .catch(() => undefined);
  }, []);

  const showIcp = icpEnabled && !!icpNumber;
  const showPolice = policeEnabled && !!policeNumber;
  const showFiling = showIcp || showPolice;

  return (
    <>
      {visitorInfoCardEnabled && <VisitorInfoCard />}
      <footer className="w-full sm:flex-row sm:gap-4 max-w-[1280px] mx-auto p-4">
        <div className="flex flex-row items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-1 items-center">
            Powered by
            <Tooltip>
              <TooltipTrigger>
                <a
                  href="https://github.com/komari-monitor/komari"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-opacity hover:opacity-80"
                >
                  <span className="font-medium text-foreground">Komari Monitor</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>{serverVersion?.version ?? ""}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            Theme by
            <Tooltip>
              <TooltipTrigger>
                <a
                  href="https://github.com/Tokinx/komari-theme-emerald"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-opacity hover:opacity-80"
                >
                  <span className="font-medium text-foreground">Komari Emerald</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <span className="whitespace-pre-line">
                  v{buildVersion}
                  {"\n"}
                  {buildGitHash}
                </span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {showFiling && (
          <div className="flex flex-wrap gap-2 items-center justify-center sm:flex-shrink-0 pb-7">
            {showIcp && (
              <a
                href={icpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-70"
              >
                <span className="text-xs text-muted-foreground">{icpNumber}</span>
              </a>
            )}
            {showIcp && showPolice && (
              <span className="opacity-50 text-xs text-muted-foreground">·</span>
            )}
            {showPolice &&
              (policeUrl ? (
                <a
                  href={policeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-opacity hover:opacity-70"
                >
                  <span className="text-xs text-muted-foreground">{policeNumber}</span>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">{policeNumber}</span>
              ))}
          </div>
        )}
      </footer>
    </>
  );
}

export default Footer;