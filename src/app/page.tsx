'use client'

import dynamic from 'next/dynamic'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Background from '@/components/Background'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import LoadingCover from '@/components/LoadingCover'
import { Provider } from '@/components/Provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'
import { selectAppDerived, useAppStore } from '@/stores/app'
import { destroyInitManager, initApp } from '@/utils/init'
import { message } from '@/utils/message'
import HomeView from '@/views/HomeView'

const instanceStatusSkeletonItems = ['cpu', 'memory', 'swap', 'disk', 'uplink', 'downlink', 'traffic', 'connections']
const instanceFinanceSkeletonItems = ['price', 'monthly', 'remaining-time', 'remaining-value']
const instanceInfoSkeletonItems = ['hardware', 'system', 'storage', 'network']

function InstanceDetailFallback() {
  return (
    <div className="instance-detail space-y-4" role="status" aria-label="正在加载">
      <div className="flex items-center gap-4 px-4">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-12 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4">
        {instanceStatusSkeletonItems.map(item => (
          <Skeleton key={item} className="min-h-26 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 px-4 lg:grid-cols-4">
        {instanceFinanceSkeletonItems.map(item => (
          <Skeleton key={item} className="min-h-10 rounded-2xl md:min-h-18" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2">
        {instanceInfoSkeletonItems.map(item => (
          <Skeleton key={item} className="min-h-40 rounded-2xl" />
        ))}
      </div>
      <div className="px-4">
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="px-4">
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}

const InstanceDetail = dynamic(() => import('@/views/InstanceDetail'), {
  loading: InstanceDetailFallback,
})

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
  const routeRef = useRef(route)

  useEffect(() => {
    window.$message = message
    initApp().catch((error) => {
      console.error('[App] Initialization failed:', error)
      useAppStore.getState().setLoading(false)
    })

    const handlePopState = () => {
      const nextRoute = window.location.pathname
      if (!INSTANCE_ROUTE_REGEX.test(routeRef.current) && INSTANCE_ROUTE_REGEX.test(nextRoute))
        useAppStore.getState().setHomeScrollPosition(window.scrollY)
      routeRef.current = nextRoute
      setRoute(nextRoute)
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      destroyInitManager()
    }
  }, [])

  useEffect(() => {
    const handleNavigate = () => {
      const nextRoute = window.location.pathname
      if (!INSTANCE_ROUTE_REGEX.test(routeRef.current) && INSTANCE_ROUTE_REGEX.test(nextRoute))
        useAppStore.getState().setHomeScrollPosition(window.scrollY)
      routeRef.current = nextRoute
      setRoute(nextRoute)
    }
    window.addEventListener('komari:navigate', handleNavigate)
    return () => window.removeEventListener('komari:navigate', handleNavigate)
  }, [])

  const match = route.match(INSTANCE_ROUTE_REGEX)

  useLayoutEffect(() => {
    if (INSTANCE_ROUTE_REGEX.test(route))
      window.scrollTo({ top: 0, behavior: 'instant' })
  }, [route])

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
