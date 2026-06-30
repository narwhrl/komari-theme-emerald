import type { Metadata, Viewport } from 'next'
import '@/styles/main.css'

export const metadata: Metadata = {
  title: 'Komari Emerald',
  description: 'An emerald theme for Komari Monitor',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  )
}
