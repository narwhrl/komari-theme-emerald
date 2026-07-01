"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { useBackTop } from "@/hooks/useBackTop";
import { cn } from "@/lib/utils";

interface BackTopProps {
  visibilityHeight?: number;
  className?: string;
}

export function BackTop({ visibilityHeight = 1, className }: BackTopProps) {
  const { scrolled, scrollToTop } = useBackTop(visibilityHeight);
  if (!scrolled) return null;
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={scrollToTop}
      aria-label="回到顶部"
      className={cn(
        "fixed bottom-5 right-5 z-40 size-9 rounded-full bg-background/60 backdrop-blur-xs shadow-sm hover:bg-background/80",
        className,
      )}
    >
      <Icon icon="tabler:arrow-up" width={16} height={16} />
    </Button>
  );
}

export default BackTop;