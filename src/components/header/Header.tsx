"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app";
import { useBackTop } from "@/hooks/useBackTop";
import { announce } from "@/components/a11y/LiveAnnouncer";

type HeaderAction = "toggleTheme" | "jumpToSetting";

interface ActionButton {
  id: HeaderAction;
  title: string;
  icon: string;
}

export function Header() {
  const themeMode = useAppStore((s) => s.themeMode);
  const cycleThemeMode = useAppStore((s) => s.cycleThemeMode);
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  // `getHideAdminEntryWhenLoggedOut` returns a fresh boolean from
  // theme_settings. Memoising the selector avoids re-rendering on every
  // store update.
  const hideAdminEntryWhenLoggedOut = useAppStore((s) =>
    s.getHideAdminEntryWhenLoggedOut(),
  );
  const sitename = useAppStore(
    (s) => s.publicSettings?.sitename || "Komari Monitor",
  );

  const { scrolled } = useBackTop(1);

  // Build the action button list. Two distinct icons: an "auto" mode that
  // visually conveys "system follow" rather than the literal "dark" icon
  // that the previous version used.
  const actionButtons = useMemo<ActionButton[]>(() => {
    const themeTitle =
      themeMode === "auto"
        ? "跟随系统主题"
        : themeMode === "light"
          ? "切换到深色主题"
          : "切换到浅色主题";
    const themeIcon =
      themeMode === "auto"
        ? "icon-park-outline:theme"
        : themeMode === "light"
          ? "icon-park-outline:sun-one"
          : "icon-park-outline:moon";

    const buttons: ActionButton[] = [
      { id: "toggleTheme", title: themeTitle, icon: themeIcon },
    ];
    if (isLoggedIn || !hideAdminEntryWhenLoggedOut) {
      buttons.push({
        id: "jumpToSetting",
        title: "后台管理",
        icon: "icon-park-outline:setting",
      });
    }
    return buttons;
  }, [themeMode, isLoggedIn, hideAdminEntryWhenLoggedOut]);

  // Switch with exhaustiveness check — TS ensures all action variants are
  // handled and we get a compile-time error if a new one is added without
  // updating this function.
  const handleButtonClick = useCallback(
    (action: HeaderAction) => {
      switch (action) {
        case "toggleTheme": {
          cycleThemeMode();
          // Read the next mode after the cycle so the announcement matches
          // the state the user just landed on.
          const next: Record<typeof themeMode, string> = {
            auto: "已切换为跟随系统主题",
            light: "已切换为浅色主题",
            dark: "已切换为深色主题",
          };
          // themeMode is a snapshot; the store has already updated, so we
          // can compute the next via the cycle order.
          announce(next[themeMode === "auto" ? "light" : themeMode === "light" ? "dark" : "auto"]);
          return;
        }
        case "jumpToSetting":
          if (typeof window !== "undefined") {
            announce("正在跳转到后台管理…");
            window.location.href = "/admin";
          }
          return;
        default: {
          const _exhaustive: never = action;
          return _exhaustive;
        }
      }
    },
    [cycleThemeMode, themeMode],
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-b transition-colors duration-200",
        scrolled
          ? "border-slate-500/10 backdrop-blur-lg"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="px-4 flex h-14 max-w-[1280px] mx-auto items-center justify-between">
        <Link
          href="/"
          aria-label={`返回首页 - ${sitename}`}
          className="flex items-center gap-3"
        >
          <Avatar className="size-8">
            <AvatarImage src="/favicon.ico" alt="" />
            <AvatarFallback>{sitename.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <h3 className="m-0 text-lg font-semibold">{sitename}</h3>
        </Link>
        <div className="flex items-center gap-2">
          {actionButtons.map((button) => {
            const tooltipText =
              button.id === "toggleTheme"
                ? `${button.title}（当前：${
                    themeMode === "auto" ? "跟随系统" : themeMode === "light" ? "浅色" : "深色"
                  }）`
                : button.title;
            return (
              <Tooltip key={button.id}>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleButtonClick(button.id)}
                      aria-label={button.title}
                    />
                  }
                >
                  <Icon icon={button.icon} width={18} height={18} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent className="text-xs px-2 py-1">
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Header;