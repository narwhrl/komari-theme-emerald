'use client'

import { Icon } from '@iconify/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function BackTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 360)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!visible)
    return null

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="返回顶部"
      className="fixed right-4 bottom-4 z-30 border-none bg-background/70 shadow-lg backdrop-blur-md"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <Icon icon="lucide:arrow-up" width={16} height={16} />
    </Button>
  )
}
