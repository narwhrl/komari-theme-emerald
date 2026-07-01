"use client";

import { Empty as CossEmpty } from "@/components/ui/empty";

interface EmptyCompatProps {
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Backwards-compatible Empty wrapper that accepts a `description` prop
 * matching the original shadcn-vue API. The coss-ui Empty is a generic
 * div, so we render the description inside it.
 */
export function Empty({ description, className }: EmptyCompatProps) {
  if (!description) return <CossEmpty className={className} />;
  return (
    <CossEmpty className={className}>
      <div className="text-muted-foreground text-sm">{description}</div>
    </CossEmpty>
  );
}

export default Empty;