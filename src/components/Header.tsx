'use client'

import { Icon } from '@iconify/react'
import { use, useMemo } from 'react'
import { ScrollContext } from '@/components/ScrollContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DataTooltip } from '@/components/ui/tooltip'
import { selectAppDerived, useAppStore } from '@/stores/app'
import { navigateTo } from '@/utils/navigation'

export default function Header() {
  const isScrolled = use(ScrollContext)
  const themeMode = useAppStore(state => state.themeMode)
  const publicSettings = useAppStore(state => state.publicSettings)
  const isLoggedIn = useAppStore(state => state.isLoggedIn)
  const updateThemeMode = useAppStore(state => state.updateThemeMode)
  const hideAdminEntryWhenLoggedOut = useAppStore(state => selectAppDerived(state).hideAdminEntryWhenLoggedOut)

  const sitename = publicSettings?.sitename || 'Komari Monitor'
  const actionButtons = useMemo(() => {
    const buttons = [
      {
        title: themeMode === 'auto' ? '自动主题' : themeMode === 'light' ? '浅色主题' : '深色主题',
        icon: themeMode === 'auto' ? 'icon-park-outline:dark-mode' : themeMode === 'light' ? 'icon-park-outline:sun-one' : 'icon-park-outline:moon',
        action: 'toggleTheme',
      },
    ]

    if (isLoggedIn || !hideAdminEntryWhenLoggedOut) {
      buttons.push({
        title: '后台管理',
        icon: 'icon-park-outline:setting',
        action: 'jumpToSetting',
      })
    }
    return buttons
  }, [hideAdminEntryWhenLoggedOut, isLoggedIn, themeMode])

  function handleButtonClick(action: string) {
    switch (action) {
      case 'toggleTheme':
        updateThemeMode()
        break
      case 'jumpToSetting':
        window.location.href = '/admin'
        break
    }
  }

  return (
    <div className={`sticky top-0 z-10 border-b border-transparent transition-all duration-200 ${isScrolled ? '!border-slate-500/10 backdrop-blur-lg' : 'bg-transparent'}`}>
      <div className="mx-auto flex-between h-14 max-w-[1280px] px-4">
        <button className="flex min-w-0 cursor-pointer items-center gap-3 text-left" onClick={() => navigateTo('/')}>
          <Avatar className="size-8">
            <AvatarImage src="/favicon.ico" alt={sitename} />
            <AvatarFallback>{sitename.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <h3 className="m-0 truncate text-lg font-semibold">{sitename}</h3>
        </button>
        <div className="flex items-center gap-2">
          {actionButtons.map(button => (
            <DataTooltip key={button.action} content={button.title} placement="left" contentClass="whitespace-nowrap text-[11px] px-2">
              <Button variant="ghost" size="icon-sm" onClick={() => handleButtonClick(button.action)}>
                <Icon icon={button.icon} width={18} height={18} />
              </Button>
            </DataTooltip>
          ))}
        </div>
      </div>
    </div>
  )
}
