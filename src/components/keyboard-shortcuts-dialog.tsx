'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open search' },
  { keys: ['n'], label: 'New task' },
  { keys: ['1'], label: 'Go to Today' },
  { keys: ['2'], label: 'Go to Next 7 Days' },
  { keys: ['3'], label: 'Go to Upcoming' },
  { keys: ['4'], label: 'Go to All Tasks' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
] as const

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground border-border/60 inline-flex min-w-[1.5rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-xs font-medium">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Speed up your workflow with these shortcuts
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2">
          {SHORTCUTS.map(({ keys, label }) => (
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
      </DialogContent>
    </Dialog>
  )
}
