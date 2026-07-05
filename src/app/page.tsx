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
      <Header />
      {!loading
        ? (
            <main className="flex-1">
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
