'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadShortcuts,
  matchesCombo,
  type KeyCombo,
  type ShortcutId,
} from '@/lib/shortcuts'

export function KeyboardShortcuts({
  onSearchOpen,
  onNewTask,
  onShortcutsOpen,
  onCommandPaletteOpen,
}: {
  onSearchOpen: () => void
  onNewTask?: () => void
  onShortcutsOpen?: () => void
  onCommandPaletteOpen?: () => void
}) {
  const { push } = useRouter()
  // Shortcuts are customizable; read them once on mount.
  const [shortcuts] = useState<Record<ShortcutId, KeyCombo>>(loadShortcuts)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return
      }

      // Most specific bindings first: Cmd/Ctrl+Shift+K
      // (search) also satisfies the plain Cmd/Ctrl+K combo.
      if (matchesCombo(e, shortcuts.search)) {
        e.preventDefault()
        onSearchOpen()
        return
      }
      if (matchesCombo(e, shortcuts.commandPalette)) {
        e.preventDefault()
        onCommandPaletteOpen?.()
        return
      }
      if (matchesCombo(e, shortcuts.newTask)) {
        e.preventDefault()
        onNewTask?.()
        return
      }
      if (matchesCombo(e, shortcuts.shortcutsHelp)) {
        e.preventDefault()
        onShortcutsOpen?.()
        return
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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    onSearchOpen,
    onNewTask,
    onShortcutsOpen,
    onCommandPaletteOpen,
    push,
    shortcuts,
  ])

  return null
}
