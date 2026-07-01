/**
 * 404 page. Renders inside the root layout (so the Header & Footer
 * stay visible). Uses coss-ui primitives for visual consistency with
 * the rest of the app.
 */
import Link from "next/link";
import { Icon } from "@iconify/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-background/80 backdrop-blur-xs border-none shadow-[0_0_2rem_rgba(0,0,0,0.08)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon icon="tabler:map-pin-off" width={20} height={20} aria-hidden="true" />
            </div>
            <div>
              <CardTitle>页面不存在</CardTitle>
              <CardDescription>
                404 — 你访问的地址没有找到对应的内容。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            请检查链接是否正确，或者返回首页继续浏览。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/" />}>
              <Icon icon="tabler:arrow-left" width={16} height={16} aria-hidden="true" />
              返回首页
            </Button>
            <Button variant="outline" render={<Link href="/#nodes" />}>
              <Icon icon="tabler:server" width={16} height={16} aria-hidden="true" />
              查看节点
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}