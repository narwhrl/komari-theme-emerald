'use client'

import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'

interface VisitorGeoData {
  ip: string
  isp: string
  location: string
  countryCode: string
}

interface VisitorClientData {
  device: string
  browser: string
}

interface VisitorInfoRow {
  value: string
  icon: string
  expandOnly?: boolean
}

const ANDROID_REGEX = /android/i
const IPHONE_OR_IPOD_REGEX = /iphone|ipod/i
const IPAD_REGEX = /ipad/i
const TABLET_REGEX = /tablet/i
const EDGE_VERSION_REGEX = /Edg\/\d+/i
const OPERA_VERSION_REGEX = /OPR\/\d+/i
const CHROME_VERSION_REGEX = /Chrome\/\d+/i
const EDGE_OR_OPERA_REGEX = /Edg|OPR/i
const FIREFOX_VERSION_REGEX = /Firefox\/\d+/i
const SAFARI_REGEX = /Safari/i
const CHROME_REGEX = /Chrome/i
const IPV4_SEGMENT_REGEX = /^\d+$/
const IPV6_SEGMENT_REGEX = /^[\dA-F]{1,4}$/i
const IPV6_DOUBLE_COLON = '::'

function formatVisitTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function maskIpv4Address(value: string): string | null {
  const segments = value.split('.')
  if (segments.length !== 4 || segments.some(segment => !IPV4_SEGMENT_REGEX.test(segment)))
    return null
  const [first, second, third, fourth] = segments as [string, string, string, string]
  return [first, second, '*'.repeat(third.length), fourth].join('.')
}

function maskIpv6Address(value: string): string | null {
  const percentIndex = value.indexOf('%')
  const address = percentIndex >= 0 ? value.slice(0, percentIndex) : value
  const scope = percentIndex >= 0 ? value.slice(percentIndex + 1) : ''
  if (!address.includes(':') || address.includes(':::'))
    return null
  const doubleColonCount = address.split(IPV6_DOUBLE_COLON).length - 1
  if (doubleColonCount > 1)
    return null
  const segments = address.split(':')
  if (segments.some((segment, index) => {
    if (!segment)
      return true
    if (segment.includes('.'))
      return index === segments.length - 1 && maskIpv4Address(segment) !== null
    return IPV6_SEGMENT_REGEX.test(segment)
  })) {
    return null
  }

  let maskedAddress = address
  if (address.includes('::')) {
    const [prefix = ''] = address.split('::')
    const visibleSegments = prefix ? prefix.split(':').filter(Boolean).slice(0, 4) : []
    maskedAddress = visibleSegments.length > 0 ? `${visibleSegments.join(':')}::*` : '::*'
  }
  else if (segments.length > 4) {
    maskedAddress = `${segments.slice(0, 4).join(':')}:*`
  }
  return scope ? `${maskedAddress}%${scope}` : maskedAddress
}

function maskIpForCollapsedState(value: string): string {
  return maskIpv4Address(value) ?? maskIpv6Address(value) ?? value
}

function detectClient(): VisitorClientData {
  const ua = navigator.userAgent
  let device = '桌面设备'
  if (ANDROID_REGEX.test(ua))
    device = 'Android 手机'
  else if (IPHONE_OR_IPOD_REGEX.test(ua))
    device = 'iPhone'
  else if (IPAD_REGEX.test(ua))
    device = 'iPad'
  else if (TABLET_REGEX.test(ua))
    device = '平板电脑'

  let browser = '未知浏览器'
  if (EDGE_VERSION_REGEX.test(ua))
    browser = 'Edge'
  else if (OPERA_VERSION_REGEX.test(ua))
    browser = 'Opera'
  else if (CHROME_VERSION_REGEX.test(ua) && !EDGE_OR_OPERA_REGEX.test(ua))
    browser = 'Chrome'
  else if (FIREFOX_VERSION_REGEX.test(ua))
    browser = 'Firefox'
  else if (SAFARI_REGEX.test(ua) && !CHROME_REGEX.test(ua))
    browser = 'Safari'

  return { device, browser }
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok)
      throw new Error(`Request failed: ${response.status}`)
    return await response.json() as T
  }
  finally {
    window.clearTimeout(timeoutId)
  }
}

async function fetchVisitorGeo(): Promise<VisitorGeoData | null> {
  const loaders = [
    async (): Promise<VisitorGeoData> => {
      const data = await fetchJson<{ ip?: string, isp?: string, organization?: string, asn_organization?: string, country?: string, country_code?: string, region?: string, city?: string }>('https://api.ip.sb/geoip', 4000)
      if (!data.ip)
        throw new Error('ip.sb unavailable')
      return { ip: data.ip, isp: data.isp || data.organization || data.asn_organization || '未知运营商', location: [data.country, data.city || data.region].filter(Boolean).join(' · ') || '未知位置', countryCode: data.country_code || '' }
    },
    async (): Promise<VisitorGeoData> => {
      const data = await fetchJson<{ success?: boolean, message?: string, ip?: string, country?: string, country_code?: string, region?: string, city?: string, connection?: { isp?: string, org?: string } }>('https://ipwho.is/', 4000)
      if (data.success === false || !data.ip)
        throw new Error(data.message || 'ipwho.is unavailable')
      return { ip: data.ip, isp: data.connection?.isp || data.connection?.org || '未知运营商', location: [data.country, data.city || data.region].filter(Boolean).join(' · ') || '未知位置', countryCode: data.country_code || '' }
    },
    async (): Promise<VisitorGeoData> => {
      const data = await fetchJson<{ error?: boolean, reason?: string, ip?: string, org?: string, country_name?: string, country_code?: string, region?: string, city?: string }>('https://ipapi.co/json/', 4000)
      if (data.error || !data.ip)
        throw new Error(data.reason || 'ipapi unavailable')
      return { ip: data.ip, isp: data.org || '未知运营商', location: [data.country_name, data.city || data.region].filter(Boolean).join(' · ') || '未知位置', countryCode: data.country_code || '' }
    },
  ]

  for (const load of loaders) {
    try {
      return await load()
    }
    catch {
    }
  }
  return null
}

export default function VisitorInfoCard() {
  const [loading, setLoading] = useState(true)
  const [device, setDevice] = useState('检测中')
  const [browser, setBrowser] = useState('检测中')
  const [ip, setIp] = useState('获取中')
  const [isp, setIsp] = useState('获取中')
  const [location, setLocation] = useState('正在定位访客来源')
  const [countryCode, setCountryCode] = useState('')
  const [visitTime, setVisitTime] = useState(formatVisitTime(new Date()))
  const [flagVisible, setFlagVisible] = useState(true)
  const [expand, setExpand] = useState(false)

  useEffect(() => {
    const client = detectClient()
    setDevice(client.device)
    setBrowser(client.browser)
    setVisitTime(formatVisitTime(new Date()))

    fetchVisitorGeo().then((geo) => {
      if (geo) {
        setIp(geo.ip)
        setIsp(geo.isp)
        setLocation(geo.location)
        setCountryCode(geo.countryCode.toUpperCase())
      }
      else {
        setIp('暂无法获取')
        setIsp('网络信息不可用')
        setLocation('网络访客')
      }
      setLoading(false)
    })
  }, [])

  const subtitle = loading ? '检测中' : location || '网络访客'
  const flagSrc = countryCode ? `/images/flags/${countryCode}.svg` : ''
  const displayIp = expand ? ip : maskIpForCollapsedState(ip)
  const rows = useMemo<VisitorInfoRow[]>(() => [
    { value: subtitle, icon: 'tabler:world-pin' },
    { value: device, icon: 'tabler:device-desktop', expandOnly: true },
    { value: displayIp, icon: 'tabler:brand-socket-io' },
    { value: browser, icon: 'tabler:browser' },
    { value: isp, icon: 'tabler:building-skyscraper', expandOnly: true },
    { value: visitTime, icon: 'tabler:clock-hour-4', expandOnly: true },
  ], [browser, device, displayIp, isp, subtitle, visitTime])
  const visibleRows = rows.filter(item => expand || !item.expandOnly)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2.5 z-30 flex justify-center">
      <button
        type="button"
        className={`pointer-events-auto cursor-default border border-border bg-background/90 p-1.5 px-3 shadow-lg backdrop-blur-md transition-[border-radius,transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none ${expand ? 'rounded-lg -translate-y-1 shadow-xl' : 'rounded-xl'}`}
        onClick={() => setExpand(value => !value)}
      >
        <div className={`transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${expand ? 'grid grid-cols-2 items-start justify-start gap-x-3 gap-y-2' : 'flex flex-nowrap items-center justify-center gap-x-3 gap-y-1'}`}>
          {visibleRows.map((item, index) => (
            <div key={item.icon} className="flex min-w-0 items-center gap-1 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transitionDelay: `${index * 28}ms` }}>
              {item.icon === 'tabler:world-pin' && flagSrc && flagVisible
                ? (
                    <img src={flagSrc} alt={countryCode} className="h-4 w-4 object-cover" onError={() => setFlagVisible(false)} />
                  )
                : (
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Icon icon={item.icon} width={14} height={14} />
                    </div>
                  )}
              <div className={`min-w-0 transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] ${expand || !index ? 'block translate-y-0 opacity-100' : 'hidden md:block md:translate-y-0 md:opacity-100'}`}>
                {loading ? <div className="h-2 w-15 animate-pulse rounded-full bg-muted/70" /> : <p className="max-w-30 truncate text-xs font-medium text-muted-foreground sm:max-w-50">{item.value}</p>}
              </div>
            </div>
          ))}
        </div>
      </button>
    </div>
  )
}
