'use client'

import { useEffect } from 'react'

export function KeyboardShortcuts({
  onSearchOpen,
  onNewTask,
}: {
  onSearchOpen: () => void
  onNewTask?: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        onSearchOpen()
      }
      // 'n' to open new task dialog (when not in input/textarea)
      if (
        e.key === 'n' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault()
        onNewTask?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSearchOpen, onNewTask])

  return null
}
