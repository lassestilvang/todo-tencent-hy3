'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, format } from 'date-fns'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Flag,
  Keyboard,
  Plus,
  Search,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAppActions } from '@/components/search-wrapper'
import { toast } from 'sonner'
import { handleClearCompleted } from '@/lib/actions'
import { updateTask } from '@/lib/tasks-client'
import {
  deriveQuickActions,
  findOverdueTasks,
  toSnapshot,
  type QuickAction,
} from '@/lib/quick-actions'
import { formatCombo, loadShortcuts } from '@/lib/shortcuts'
import type { ShortcutId } from '@/lib/shortcuts'
import type { Task } from '@/types'

const ACTION_ICONS: Record<string, LucideIcon> = {
  'clear-completed': CheckCircle2,
  'review-overdue': AlertTriangle,
  'reschedule-overdue': CalendarClock,
  'finish-high-priority': Flag,
  'plan-unplanned': CalendarClock,
}

const SHORTCUT_LABELS: Record<ShortcutId, string> = {
  commandPalette: 'Palette',
  search: 'Search',
  newTask: 'New task',
  shortcutsHelp: 'Shortcuts',
}

/**
 * The quick actions panel: common operations plus
 * suggestions derived from the tasks at hand, with
 * the current keyboard shortcuts at the bottom.
 */
export function QuickActions({
  tasks,
  view,
}: {
  tasks: Task[]
  view?: 'today' | 'next7' | 'upcoming' | 'all'
}) {
  const router = useRouter()
  const { openNewTask, openSearch } = useAppActions()

  const today = format(new Date(), 'yyyy-MM-dd')
  const snapshots = useMemo(() => tasks.map(toSnapshot), [tasks])
  const actions = useMemo(
    () => deriveQuickActions(snapshots, { today, view }),
    [snapshots, today, view],
  )
  // Read once; the shortcuts dialog customizes them.
  const shortcuts = useMemo(() => loadShortcuts(), [])

  const runAction = async (action: QuickAction) => {
    switch (action.id) {
      case 'clear-completed':
        await handleClearCompleted()
        router.refresh()
        toast.success('Completed tasks cleared')
        break
      case 'reschedule-overdue': {
        const overdue = findOverdueTasks(snapshots, today)
        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
        await Promise.all(
          overdue.map((task) =>
            updateTask(task.id, { date: tomorrow }),
          ),
        )
        router.refresh()
        toast.success(
          `Rescheduled ${overdue.length} task${
            overdue.length === 1 ? '' : 's'
          } to tomorrow`,
        )
        break
      }
      case 'review-overdue':
      case 'finish-high-priority':
      case 'plan-unplanned':
        if (action.href) {
          router.push(action.href)
        }
        break
      default:
        break
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={openNewTask}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New task
          </Button>
          <Button size="sm" variant="outline" onClick={openSearch}>
            <Search className="mr-1 h-3.5 w-3.5" />
            Search
          </Button>
        </div>

        {actions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Suggested
            </p>
            {actions.map((action) => {
              const Icon = ACTION_ICONS[action.id] ?? Zap
              return (
                <Button
                  key={action.id}
                  size="sm"
                  variant={
                    action.variant === 'destructive'
                      ? 'destructive'
                      : action.variant === 'primary'
                        ? 'default'
                        : 'outline'
                  }
                  className="w-full justify-start"
                  onClick={() => runAction(action)}
                >
                  <Icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate text-left">
                    {action.title}
                  </span>
                  <span className="text-muted-foreground/70 text-xs">
                    {action.count}
                  </span>
                </Button>
              )
            })}
          </div>
        )}

        <div className="border-border/60 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
          <Keyboard className="h-3 w-3" />
          {(Object.keys(SHORTCUT_LABELS) as ShortcutId[]).map((id) => (
            <span key={id} className="flex items-center gap-1">
              <kbd className="bg-muted rounded border px-1 py-0.5 font-mono">
                {formatCombo(shortcuts[id])}
              </kbd>
              {SHORTCUT_LABELS[id]}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
