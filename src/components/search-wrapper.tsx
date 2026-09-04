'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react'
import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { CreateTaskForm } from '@/components/create-task-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { Button } from '@/components/ui/button'
import type { DueReminder } from '@/lib/tasks'
import { drainQueue } from '@/lib/offline-queue'

// The search dialog, shortcuts dialog, and command
// palette open on demand (⌘K, ?), so their code is
// split out of the initial bundle and fetched the
// first time they open. They render nothing until
// then, so there is nothing to server-render.
const SearchDialog = dynamic(
  () =>
    import('@/components/search-dialog').then(
      (module) => module.SearchDialog,
    ),
  { ssr: false },
)
const KeyboardShortcutsDialog = dynamic(
  () =>
    import('@/components/keyboard-shortcuts-dialog').then(
      (module) => module.KeyboardShortcutsDialog,
    ),
  { ssr: false },
)
const CommandPalette = dynamic(
  () =>
    import('@/components/command-palette').then(
      (module) => module.CommandPalette,
    ),
  { ssr: false },
)

interface AppActions {
  openSearch: () => void
  openNewTask: () => void
  openShortcuts: () => void
  openCommandPalette: () => void
}

const AppActionsContext = createContext<AppActions | null>(null)

export function useAppActions() {
  const ctx = useContext(AppActionsContext)
  if (!ctx) {
    throw new Error('useAppActions must be used within SearchWrapper')
  }
  return ctx
}

export function SearchTrigger({
  className,
  size = 'icon',
}: {
  className?: string
  size?: 'icon' | 'sm'
}) {
  const { openSearch } = useAppActions()
  return (
    <Button
      variant="ghost"
      size={size}
      onClick={openSearch}
      aria-label="Search tasks"
      title="Search (⌘K)"
      className={className}
    >
      <Search className="h-4 w-4" />
      {size === 'sm' && <span className="ml-2">Search</span>}
    </Button>
  )
}

export function CommandPaletteTrigger({
  className,
}: {
  className?: string
}) {
  const { openCommandPalette } = useAppActions()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openCommandPalette}
      aria-label="Command palette"
      title="Command Palette (⌘K)"
      className={className}
    >
      <Search className="h-4 w-4" />
    </Button>
  )
}

export function SearchWrapper({ children }: { children?: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

  const openSearch = useCallback(() => setIsSearchOpen(true), [])
  const openNewTask = useCallback(() => setIsNewTaskOpen(true), [])
  const openShortcuts = useCallback(() => setIsShortcutsOpen(true), [])
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), [])

  const actions = useMemo(
    () => ({ openSearch, openNewTask, openShortcuts, openCommandPalette }),
    [openSearch, openNewTask, openShortcuts, openCommandPalette]
  )

  // Background task management: sweep for due task
  // reminders every minute and surface them as toasts.
  // A failed sweep (offline) is retried by the next one.
  useEffect(() => {
    const sweep = async () => {
      try {
        const response = await fetch('/api/reminders')
        if (!response.ok) {
          return
        }
        const { reminders } = (await response.json()) as {
          reminders: DueReminder[]
        }
        for (const reminder of reminders) {
          toast(`⏰ ${reminder.taskName}`, {
            description: 'Reminder is due',
          })
        }
      } catch {
        // Offline or failed — the next sweep retries.
      }
    }

    sweep()
    const interval = setInterval(sweep, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Offline queue: replay queued mutations
  // when connectivity returns — and every
  // 30s in case the online event was
  // missed (e.g. the tab was asleep).
  useEffect(() => {
    const drain = async () => {
      try {
        const delivered = await drainQueue()
        if (delivered.length > 0) {
          toast.success(
            `${delivered.length} queued change${
              delivered.length === 1 ? '' : 's'
            } synced`
          )
        }
      } catch {
        // The next drain retries.
      }
    }

    window.addEventListener('online', drain)
    const interval = setInterval(drain, 30_000)
    // Drain on mount too: a previous
    // session may have queued mutations.
    drain()

    return () => {
      window.removeEventListener('online', drain)
      clearInterval(interval)
    }
  }, [])

  return (
    <AppActionsContext.Provider value={actions}>
      {children}
      <KeyboardShortcuts
        onSearchOpen={openSearch}
        onNewTask={openNewTask}
        onShortcutsOpen={openShortcuts}
        onCommandPaletteOpen={openCommandPalette}
      />
      {isSearchOpen && (
        <SearchDialog
          open={isSearchOpen}
          onOpenChange={setIsSearchOpen}
        />
      )}
      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your todo list
            </DialogDescription>
          </DialogHeader>
          <CreateTaskForm />
        </DialogContent>
      </Dialog>
      {isShortcutsOpen && (
        <KeyboardShortcutsDialog
          open={isShortcutsOpen}
          onOpenChange={setIsShortcutsOpen}
        />
      )}
      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNewTask={openNewTask}
          onSearch={openSearch}
          onShortcuts={openShortcuts}
        />
      )}
    </AppActionsContext.Provider>
  )
}
