'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function KeyboardShortcuts({
  onSearchOpen,
  onNewTask,
  onShortcutsOpen,
}: {
  onSearchOpen: () => void
  onNewTask?: () => void
  onShortcutsOpen?: () => void
}) {
  const { push } = useRouter()
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return
      }

      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        onSearchOpen()
      }
      // 'n' to open new task dialog
      if (e.key === 'n') {
        e.preventDefault()
        onNewTask?.()
      }
      // View navigation: 1=Today, 2=Next7, 3=Upcoming, 4=All
      if (e.key === '1') {
        e.preventDefault()
        push('/today')
      }
      if (e.key === '2') {
        e.preventDefault()
        push('/next7')
      }
      if (e.key === '3') {
        e.preventDefault()
        push('/upcoming')
      }
      if (e.key === '4') {
        e.preventDefault()
        push('/all')
      }
      if (e.key === '?') {
        e.preventDefault()
        onShortcutsOpen?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSearchOpen, onNewTask, onShortcutsOpen, push])

  return null
}
