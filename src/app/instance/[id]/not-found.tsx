/**
 * Per-route 404. Triggers when a user navigates to a non-existent
 * /instance/<id> while the static shell loads. The same path is also
 * used for the "节点不存在" state in the page itself; this catches
 * cases where Next.js can't find the dynamic route at all.
 */
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

export default function InstanceNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-background/80 backdrop-blur-xs border-none shadow-[0_0_2rem_rgba(0,0,0,0.08)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon icon="tabler:server-off" width={20} height={20} aria-hidden="true" />
            </div>
            <div>
              <CardTitle>节点未找到</CardTitle>
              <CardDescription>
                这个 UUID 对应的节点在当前数据源中不存在，可能已被删除。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/" />}>
            <Icon icon="tabler:arrow-left" width={16} height={16} aria-hidden="true" />
            返回首页
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}