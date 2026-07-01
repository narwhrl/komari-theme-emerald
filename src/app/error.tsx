"use client";

/**
 * Global error boundary for the App Router.
 *
 * Catches uncaught exceptions thrown in the route segment tree. Shown
 * inside the existing layout (so the header & footer stay visible), with
 * a single "重试" affordance and a copyable error message for support.
 *
 * The `digest` field, when present, is a server-side hash of the error
 * and is safe to log / show to end users.
 */
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log to console for developers; in production this should go to a
    // remote service like Sentry. Kept minimal to avoid extra deps.
    console.error("[AppErrorBoundary]", error);
  }, [error]);

  const reportText = [
    error.message,
    error.digest ? `digest: ${error.digest}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  async function copyReport() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write can fail in insecure contexts — silently fall back.
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card
        role="alert"
        aria-live="assertive"
        className="w-full max-w-lg bg-background/80 backdrop-blur-xs border-none shadow-[0_0_2rem_rgba(0,0,0,0.08)]"
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Icon icon="tabler:alert-triangle" width={20} height={20} aria-hidden="true" />
            </div>
            <div>
              <CardTitle>页面出错了</CardTitle>
              <CardDescription>
                应用遇到了一个意外错误。你可以重试，或返回首页。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted/50 p-3 text-xs font-mono text-muted-foreground break-all">
            {error.message || "未知错误"}
            {error.digest && (
              <div className="mt-1 text-[10px] opacity-60">
                digest: {error.digest}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} variant="default">
              <Icon icon="tabler:refresh" width={16} height={16} aria-hidden="true" />
              重试
            </Button>
            <Button variant="outline" onClick={copyReport}>
              <Icon
                icon={copied ? "tabler:check" : "tabler:copy"}
                width={16}
                height={16}
                aria-hidden="true"
              />
              {copied ? "已复制" : "复制错误信息"}
            </Button>
            <Button variant="ghost" render={<Link href="/" />}>
              <Icon icon="tabler:arrow-left" width={16} height={16} aria-hidden="true" />
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}