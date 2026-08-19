'use client'

import { useEffect, useState } from 'react'
import Background from '@/components/Background'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import LoadingCover from '@/components/LoadingCover'
import { Provider } from '@/components/Provider'
import { Toaster } from '@/components/ui/sonner'
import { selectAppDerived, useAppStore } from '@/stores/app'
import { destroyInitManager, initApp } from '@/utils/init'
import { message } from '@/utils/message'
import HomeView from '@/views/HomeView'
import InstanceDetail from '@/views/InstanceDetail'

const INSTANCE_ROUTE_REGEX = /^\/instance\/([^/]+)$/

declare global {
  interface Window {
    $message?: typeof message
  }
}

export default function AppPage() {
  const loading = useAppStore(state => state.loading)
  const disablePageAnimation = useAppStore(state => selectAppDerived(state).disablePageAnimation)
  const [route, setRoute] = useState(() => typeof window === 'undefined' ? '/' : window.location.pathname)

  useEffect(() => {
    window.$message = message
    initApp().catch((error) => {
      console.error('[App] Initialization failed:', error)
      useAppStore.getState().setLoading(false)
    })

    const handlePopState = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      destroyInitManager()
    }
  }, [])

  useEffect(() => {
    const handleNavigate = () => setRoute(window.location.pathname)
    window.addEventListener('komari:navigate', handleNavigate)
    return () => window.removeEventListener('komari:navigate', handleNavigate)
  }, [])

  const match = route.match(INSTANCE_ROUTE_REGEX)

  return (
    <Provider>
      <Background />
      {loading ? <LoadingCover /> : null}
      {!loading
        ? (
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:h-9 focus:items-center focus:rounded-lg focus:border focus:border-input focus:bg-background focus:px-3 focus:text-sm focus:text-foreground focus:shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              跳到主要内容
            </a>
          )
        : null}
      <Header />
      {!loading
        ? (
            <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
              <div className="mx-auto max-w-[1280px]">
                <div key={route} className={disablePageAnimation ? undefined : 'animate-in fade-in slide-in-from-bottom-2 duration-200'}>
                  {match ? <InstanceDetail id={decodeURIComponent(match[1] ?? '')} /> : <HomeView />}
                </div>
              </div>
            </main>
          )
        : null}
      {!loading ? <Footer /> : null}
      <Toaster />
    </Provider>
  )
}
