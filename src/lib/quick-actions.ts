/**
 * Quick actions engine
 *
 * Pure logic behind the quick actions panel: it derives
 * context-aware suggestions from the tasks at hand
 * ("Clear 3 completed", "Review 2 overdue") and resolves
 * the bulk date presets used by the bulk operations
 * toolbar.
 */

import { addDays, format } from 'date-fns'
import type { Task } from '@/types'

/** The task fields the derivations need. */
export interface TaskSnapshot {
  id: string
  name: string
  completed: boolean
  priority: 'high' | 'medium' | 'low' | 'none'
  /** `yyyy-MM-dd`, possibly with a time part. */
  date: string | null
  deadline: string | null
}

export interface QuickActionContext {
  /** Today as `yyyy-MM-dd`, for overdue comparisons. */
  today: string
  /** The view the panel is rendered on. */
  view?: 'today' | 'next7' | 'upcoming' | 'all'
}

export type QuickActionVariant = 'default' | 'primary' | 'destructive'

export interface QuickAction {
  id: string
  title: string
  /** Why the action is suggested. */
  detail: string
  /** Badge count — how many tasks the action affects. */
  count: number
  variant: QuickActionVariant
  /** Where the action navigates, when it is not a mutation. */
  href?: string
}

/** Narrow a full task to the snapshot the panel needs. */
export function toSnapshot(task: Task): TaskSnapshot {
  return {
    id: task.id,
    name: task.name,
    completed: task.completed,
    priority: task.priority,
    date: task.date ?? null,
    deadline: task.deadline ?? null,
  }
}

/** Compare only the date part of a `yyyy-MM-dd(…)` string. */
function datePart(value: string | null): string | null {
  return value ? value.slice(0, 10) : null
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function findCompletedTasks(tasks: TaskSnapshot[]): TaskSnapshot[] {
  return tasks.filter((task) => task.completed)
}

/** Incomplete tasks dated or due before today. */
export function findOverdueTasks(
  tasks: TaskSnapshot[],
  today: string,
): TaskSnapshot[] {
  return tasks.filter((task) => {
    if (task.completed) {
      return false
    }
    const date = datePart(task.date)
    const deadline = datePart(task.deadline)
    return (
      (date !== null && date < today) ||
      (deadline !== null && deadline < today)
    )
  })
}

/** Incomplete high-priority tasks due today or overdue. */
export function findHighPriorityDueTasks(
  tasks: TaskSnapshot[],
  today: string,
): TaskSnapshot[] {
  return tasks.filter((task) => {
    if (task.completed || task.priority !== 'high') {
      return false
    }
    const date = datePart(task.date)
    const deadline = datePart(task.deadline)
    return (
      (date !== null && date <= today) ||
      (deadline !== null && deadline <= today)
    )
  })
}

/** Incomplete high-priority tasks without any date. */
export function findUnplannedHighPriorityTasks(
  tasks: TaskSnapshot[],
): TaskSnapshot[] {
  return tasks.filter(
    (task) =>
      !task.completed &&
      task.priority === 'high' &&
      datePart(task.date) === null &&
      datePart(task.deadline) === null,
  )
}

/**
 * Suggest the actions that matter right now. Each suggestion
 * carries the task count it affects so the panel can show
 * exactly what would happen.
 */
export function deriveQuickActions(
  tasks: TaskSnapshot[],
  context: QuickActionContext,
): QuickAction[] {
  const { today } = context
  const actions: QuickAction[] = []

  const completed = findCompletedTasks(tasks)
  if (completed.length > 0) {
    actions.push({
      id: 'clear-completed',
      title: `Clear ${plural(completed.length, 'completed task')}`,
      detail: 'Keep the list focused on what is left',
      count: completed.length,
      variant: 'destructive',
    })
  }

  const overdue = findOverdueTasks(tasks, today)
  if (overdue.length > 0) {
    actions.push({
      id: 'review-overdue',
      title: `Review ${plural(overdue.length, 'overdue task')}`,
      detail: 'Decide whether to finish or reschedule them',
      count: overdue.length,
      variant: 'primary',
      href: '/all',
    })
    actions.push({
      id: 'reschedule-overdue',
      title: `Reschedule ${plural(overdue.length, 'overdue task')} to tomorrow`,
      detail: 'Move them to the top of tomorrow’s list',
      count: overdue.length,
      variant: 'default',
    })
  }

  const highPriority = findHighPriorityDueTasks(tasks, today)
  if (highPriority.length > 0) {
    actions.push({
      id: 'finish-high-priority',
      title: `Finish ${plural(highPriority.length, 'high-priority task')}`,
      detail: 'Due today or already overdue',
      count: highPriority.length,
      variant: 'primary',
      href: '/all?priority=high&completed=false',
    })
  }

  const unplanned = findUnplannedHighPriorityTasks(tasks)
  if (unplanned.length > 0) {
    actions.push({
      id: 'plan-unplanned',
      title: `Plan ${plural(unplanned.length, 'unplanned task')}`,
      detail: 'High-priority tasks without a date',
      count: unplanned.length,
      variant: 'default',
      href: '/all?priority=high&completed=false',
    })
  }

  return actions
}

/** The due-date presets offered by the bulk operations toolbar. */
export type BulkDatePreset = 'today' | 'tomorrow' | 'next-week' | 'clear'

export const BULK_DATE_PRESETS: BulkDatePreset[] = [
  'today',
  'tomorrow',
  'next-week',
  'clear',
]

/**
 * Resolve a bulk date preset to a `yyyy-MM-dd` date.
 * 'clear' resolves to null, which unsets the date.
 */
export function resolveBulkDate(
  preset: BulkDatePreset,
  today: Date = new Date(),
): string | null {
  switch (preset) {
    case 'today':
      return format(today, 'yyyy-MM-dd')
    case 'tomorrow':
      return format(addDays(today, 1), 'yyyy-MM-dd')
    case 'next-week':
      return format(addDays(today, 7), 'yyyy-MM-dd')
    case 'clear':
      return null
  }
}
