'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  formatCombo,
  loadShortcuts,
  resetShortcuts,
  saveShortcut,
  type KeyCombo,
  type ShortcutId,
} from '@/lib/shortcuts'

const CUSTOMIZABLE_SHORTCUTS: { id: ShortcutId; label: string }[] = [
  { id: 'commandPalette', label: 'Open command palette' },
  { id: 'search', label: 'Open search' },
  { id: 'newTask', label: 'New task' },
  { id: 'shortcutsHelp', label: 'Show keyboard shortcuts' },
]

/** View navigation keys, kept fixed. */
const VIEW_SHORTCUTS = [
  { keys: ['1'], label: 'Go to Today' },
  { keys: ['2'], label: 'Go to Next 7 Days' },
  { keys: ['3'], label: 'Go to Upcoming' },
  { keys: ['4'], label: 'Go to All Tasks' },
] as const

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground border-border/60 inline-flex min-w-[1.5rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-xs font-medium">
      {children}
    </kbd>
  )
}

function ComboKeys({ combo }: { combo: KeyCombo }) {
  const parts = formatCombo(combo).split('+')
  return (
    <>
      {parts.map((part) => (
        <Kbd key={part}>{part}</Kbd>
      ))}
    </>
  )
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [shortcuts, setShortcuts] = useState<
    Record<ShortcutId, KeyCombo>
  >(loadShortcuts)
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null)

  // While recording, the next key press (modifiers plus a
  // final key) becomes the new binding.
  useEffect(() => {
    if (!recordingId) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRecordingId(null)
        return
      }
      // Wait for the final key, not a lone modifier press.
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
        return
      }

      const combo: KeyCombo = {
        key: e.key,
        meta: e.metaKey ? true : undefined,
        ctrl: e.ctrlKey ? true : undefined,
        shift: e.shiftKey ? true : undefined,
        alt: e.altKey ? true : undefined,
      }

      try {
        const saved = saveShortcut(recordingId, formatCombo(combo))
        setShortcuts((prev) => ({ ...prev, [recordingId]: saved }))
        toast.success(
          `Shortcut updated to ${formatCombo(saved)}`,
        )
      } catch {
        toast.error('That key cannot be used as a shortcut')
      }
      setRecordingId(null)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingId])

  const handleReset = () => {
    resetShortcuts()
    setShortcuts(loadShortcuts())
    setRecordingId(null)
    toast.success('Shortcuts reset to defaults')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Speed up your workflow with these shortcuts — select one to
            customize it.
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2">
          {CUSTOMIZABLE_SHORTCUTS.map(({ id, label }) => (
            <div
              key={id}
              className="flex items-center justify-between gap-4 py-1"
            >
              <dt className="text-sm">{label}</dt>
              <dd className="flex items-center gap-1">
                {recordingId === id ? (
                  <span className="animate-pulse font-mono text-xs text-primary">
                    Press keys…
                  </span>
                ) : (
                  <>
                    <ComboKeys combo={shortcuts[id]} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setRecordingId(id)}
                      aria-label={`Change shortcut for ${label}`}
                    >
                      Edit
                    </Button>
                  </>
                )}
              </dd>
            </div>
          ))}
          {VIEW_SHORTCUTS.map(({ keys, label }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-1"
            >
              <dt className="text-sm">{label}</dt>
              <dd className="flex items-center gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
