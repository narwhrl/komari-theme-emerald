'use client'

/* eslint-disable node/prefer-global/process */

import { Icon } from '@iconify/react'
import { use, useEffect, useMemo, useState } from 'react'
import CommandMenu from '@/components/CommandMenu'
import { ScrollContext } from '@/components/ScrollContext'
import { useThemeModeTransition } from '@/components/ThemeTransitionContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTooltip } from '@/components/ui/tooltip'
import { useI18n } from '@/composables/useI18n'
import { getAlternateLang } from '@/i18n'
import { cn } from '@/lib/utils'
import { selectAppDerived, useAppStore } from '@/stores/app'
import { navigateTo } from '@/utils/navigation'

const topbarButtonClass = 'hover:translate-y-0'
const isCloudflarePages = process.env.NEXT_PUBLIC_IS_CLOUDFLARE_PAGES === 'true'
const githubRepositoryUrl = process.env.NEXT_PUBLIC_GITHUB_REPOSITORY_URL

type HeaderAction = 'toggleTheme' | 'jumpToSetting' | 'openGithubRepository'

interface HeaderActionButton {
  title: string
  icon: string
  action: HeaderAction
  label?: string
}

function HeaderActionsSkeleton() {
  const { t } = useI18n()

  return (
    <div role="status" aria-busy="true" aria-label={t('header.actionsLoading')} className="flex items-center gap-2">
      <Skeleton className="h-8 w-25 rounded-md max-[359px]:size-8 max-[359px]:w-8" />
      <Skeleton className="size-8 rounded-md" />
      <Skeleton className="size-8 rounded-md" />
      <Skeleton className={isCloudflarePages ? 'h-8 w-18 rounded-md max-[359px]:size-8 max-[359px]:w-8' : 'size-8 rounded-md'} />
    </div>
  )
}

export default function Header() {
  const isScrolled = use(ScrollContext)
  const { lang, t } = useI18n()
  const themeMode = useAppStore(state => state.themeMode)
  const publicSettings = useAppStore(state => state.publicSettings)
  const isLoggedIn = useAppStore(state => state.isLoggedIn)
  const homeSearchText = useAppStore(state => state.homeSearchText)
  const setLang = useAppStore(state => state.setLang)
  const updateThemeMode = useThemeModeTransition()
  const hideAdminEntryWhenLoggedOut = useAppStore(state => selectAppDerived(state).hideAdminEntryWhenLoggedOut)
  const [commandOpen, setCommandOpen] = useState(false)

  const isSiteLoading = publicSettings === undefined
  const sitename = publicSettings?.sitename || 'Komari Monitor'
  const languageLabel = lang === 'zh-CN' ? t('header.switchEnglish') : t('header.switchChinese')
  const languageTarget = lang === 'zh-CN' ? t('language.shortEnglish') : t('language.shortChinese')
  const actionButtons = useMemo<HeaderActionButton[]>(() => {
    const buttons: HeaderActionButton[] = [
      {
        title: themeMode === 'auto' ? t('header.themeAuto') : themeMode === 'light' ? t('header.themeLight') : t('header.themeDark'),
        icon: themeMode === 'auto' ? 'icon-park-outline:dark-mode' : themeMode === 'light' ? 'icon-park-outline:sun-one' : 'icon-park-outline:moon',
        action: 'toggleTheme',
      },
    ]

    if (isCloudflarePages) {
      buttons.push({
        title: t('header.starGithub'),
        icon: 'lucide:github',
        action: 'openGithubRepository',
        label: 'Star',
      })
    }
    else if (isLoggedIn || !hideAdminEntryWhenLoggedOut) {
      buttons.push({
        title: t('header.admin'),
        icon: 'icon-park-outline:setting',
        action: 'jumpToSetting',
      })
    }
    return buttons
  }, [hideAdminEntryWhenLoggedOut, isLoggedIn, t, themeMode])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isSiteLoading || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k')
        return

      event.preventDefault()
      setCommandOpen(open => !open)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSiteLoading])

  function handleButtonClick(action: HeaderAction) {
    switch (action) {
      case 'toggleTheme':
        updateThemeMode()
        break
      case 'jumpToSetting':
        window.location.href = '/admin'
        break
      case 'openGithubRepository':
        window.open(githubRepositoryUrl, '_blank', 'noopener,noreferrer')
        break
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ease-out',
        isScrolled ? 'border-border bg-background/72 shadow-xs backdrop-blur-lg' : 'border-transparent bg-transparent shadow-none backdrop-blur-none',
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4">
        <button
          type="button"
          className="group/brand flex min-w-0 cursor-pointer items-center gap-3 rounded-md text-left outline-none transition-[color,box-shadow] duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/30"
          aria-label={isSiteLoading ? t('header.siteLoading') : sitename}
          aria-busy={isSiteLoading}
          onClick={() => navigateTo('/')}
        >
          {isSiteLoading
            ? (
                <>
                  <span aria-hidden="true" className="komari-skeleton block size-8 shrink-0 rounded-full" />
                  <span aria-hidden="true" className="komari-skeleton block h-4 w-32 max-w-[34vw] rounded-md" />
                </>
              )
            : (
                <>
                  <Avatar className="size-8 ring-1 ring-border transition-transform duration-200 ease-out group-hover/brand:scale-105">
                    <AvatarImage src="/favicon.ico" alt={sitename} />
                    <AvatarFallback>{sitename.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <h1 className="m-0 min-w-0 max-w-[34vw] truncate text-base font-semibold tracking-tight sm:max-w-none">{sitename}</h1>
                </>
              )}
        </button>

        <div className="min-w-0 flex-1" />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isSiteLoading
            ? <HeaderActionsSkeleton />
            : (
                <>
                  <DataTooltip content="Command · Ctrl K" placement="bottom" contentClass="whitespace-nowrap text-[11px] px-2">
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={t('header.openCommand')}
                      aria-keyshortcuts="Control+K Meta+K"
                      className={cn(
                        topbarButtonClass,
                        'h-8 gap-1.5 border-input bg-popover px-2.5 shadow-xs/5 not-dark:bg-clip-padding hover:bg-accent/50 dark:bg-input/32 dark:hover:bg-input/64 max-[359px]:size-8 max-[359px]:gap-0 max-[359px]:px-0',
                        homeSearchText.trim() && 'border-foreground/20 text-foreground',
                      )}
                      onClick={() => setCommandOpen(true)}
                    >
                      <Icon icon="tabler:search" width={18} height={18} className="shrink-0 text-foreground/70" />
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1 text-foreground/70 max-[359px]:hidden">
                        <Icon icon="tabler:command" width={15} height={15} />
                      </span>
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1 font-mono text-sm font-medium text-foreground/70 max-[359px]:hidden">K</span>
                    </Button>
                  </DataTooltip>

                  {actionButtons.filter(button => button.action === 'toggleTheme').map(button => (
                    <DataTooltip key={button.action} content={button.title} placement="bottom" contentClass="whitespace-nowrap text-[11px] px-2">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={button.title} className={topbarButtonClass} onClick={() => handleButtonClick(button.action)}>
                        <Icon icon={button.icon} width={18} height={18} aria-hidden="true" />
                      </Button>
                    </DataTooltip>
                  ))}

                  <DataTooltip content={languageLabel} placement="bottom" contentClass="whitespace-nowrap text-[11px] px-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={languageLabel}
                      className={topbarButtonClass}
                      onClick={() => setLang(getAlternateLang(lang))}
                    >
                      <span className="text-xs font-semibold">{languageTarget}</span>
                    </Button>
                  </DataTooltip>

                  {actionButtons.filter(button => button.action !== 'toggleTheme').map(button => (
                    <DataTooltip key={button.action} content={button.title} placement="bottom" contentClass="whitespace-nowrap text-[11px] px-2">
                      <Button
                        type="button"
                        variant={button.label ? 'default' : 'ghost'}
                        size={button.label ? 'sm' : 'icon-sm'}
                        aria-label={button.title}
                        className={cn(topbarButtonClass, button.label && 'max-[359px]:size-8 max-[359px]:px-0')}
                        onClick={() => handleButtonClick(button.action)}
                      >
                        <Icon icon={button.icon} width={button.label ? 16 : 18} height={button.label ? 16 : 18} aria-hidden="true" />
                        {button.label ? <span className="max-[359px]:hidden">{button.label}</span> : null}
                      </Button>
                    </DataTooltip>
                  ))}
                </>
              )}
        </div>
      </div>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  )
}
