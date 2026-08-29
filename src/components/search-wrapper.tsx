'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { Search } from 'lucide-react'
import { SearchDialog } from '@/components/search-dialog'
import { CreateTaskForm } from '@/components/create-task-form'
import { CommandPalette } from '@/components/command-palette'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { Button } from '@/components/ui/button'

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

  return (
    <AppActionsContext.Provider value={actions}>
      {children}
      <KeyboardShortcuts
        onSearchOpen={openSearch}
        onNewTask={openNewTask}
        onShortcutsOpen={openShortcuts}
        onCommandPaletteOpen={openCommandPalette}
      />
      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
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
      <KeyboardShortcutsDialog
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
      />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </AppActionsContext.Provider>
  )
}
