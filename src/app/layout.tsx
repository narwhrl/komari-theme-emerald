import type { Metadata, Viewport } from 'next'
import '@/styles/main.css'

export const metadata: Metadata = {
  title: 'Komari Monitor',
  description: 'A Vercel-inspired theme for Komari Monitor',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <div data-base-ui-root className="relative isolate flex min-h-svh flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
