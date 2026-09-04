/**
 * Calendar sync conflict detection and resolution
 *
 * A conflict is a linked task/event pair whose
 * content has diverged — the task's name or date
 * no longer matches the calendar event it is
 * linked to. Resolution picks a winner and
 * describes what the losing side must be updated
 * to; persisting the patch stays with the caller.
 */

import type { CalendarEvent } from '../calendar'
import type { Task } from '@/types'

/** Which side a conflict is resolved in favor of. */
export type ConflictStrategy = 'task' | 'calendar' | 'newest'

export type ConflictField = 'name' | 'date'

export interface CalendarConflict {
  taskId: string
  eventId: string
  /** The fields the two sides disagree on. */
  differences: ConflictField[]
  task: Task
  event: CalendarEvent
}

export interface ConflictResolution {
  conflict: CalendarConflict
  winner: 'task' | 'calendar'
  /** What the calendar event must be updated to. */
  eventPatch: { summary?: string; start?: { dateTime: string } }
  /** What the TaskFlow task must be updated to. */
  taskPatch: { name?: string; date?: string }
}

/** The `yyyy-MM-dd` a calendar event starts on. */
function eventDatePart(event: CalendarEvent): string | null {
  const start = event.start?.dateTime ?? event.start?.date
  return start ? start.slice(0, 10) : null
}

/** The event a task is linked to, if it is in the list. */
export function findLinkedEvent(
  task: Task,
  events: CalendarEvent[]
): CalendarEvent | undefined {
  // Imported tasks link to the event they came
  // from; native tasks own the `task-{id}` event.
  if (task.source_event_id) {
    const bySource = events.find(
      (event) => event.id === task.source_event_id
    )
    if (bySource) {
      return bySource
    }
  }
  return events.find((event) => event.id === `task-${task.id}`)
}

/**
 * Every linked task/event pair whose name or
 * date has diverged. Completed tasks are left
 * alone — they are history, not work to reschedule.
 */
export function findConflicts(
  tasks: Task[],
  events: CalendarEvent[]
): CalendarConflict[] {
  const conflicts: CalendarConflict[] = []

  for (const task of tasks) {
    if (task.completed) {
      continue
    }

    const event = findLinkedEvent(task, events)
    if (!event) {
      continue
    }

    const differences: ConflictField[] = []
    if ((event.summary ?? '') !== task.name) {
      differences.push('name')
    }

    const taskDate = task.date?.slice(0, 10) ?? null
    if (eventDatePart(event) !== taskDate) {
      differences.push('date')
    }

    if (differences.length > 0) {
      conflicts.push({
        taskId: task.id,
        eventId: event.id,
        differences,
        task,
        event,
      })
    }
  }

  return conflicts
}

/**
 * Move an event's start onto a `yyyy-MM-dd`
 * date, keeping its time of day.
 */
function eventStartOn(event: CalendarEvent, date: string): { dateTime: string } {
  const current = event.start?.dateTime
  const timeOfDay = current ? current.slice(10) : 'T09:00:00'
  return { dateTime: `${date}${timeOfDay}` }
}

function isoAfter(a: string | null | undefined, b: string): boolean {
  return a !== undefined && a !== null && a > b
}

/**
 * Resolve one conflict.
 *
 * - `task`: the TaskFlow task wins
 * - `calendar`: the calendar event wins
 * - `newest`: whichever side was updated more
 *   recently wins (ties go to the task)
 */
export function resolveConflict(
  conflict: CalendarConflict,
  strategy: ConflictStrategy
): ConflictResolution {
  const { task, event } = conflict

  let winner: 'task' | 'calendar'
  switch (strategy) {
    case 'calendar':
      winner = 'calendar'
      break
    case 'newest':
      // ISO-8601 timestamps compare
      // lexicographically.
      winner = isoAfter(event.updated, task.updated_at)
        ? 'calendar'
        : 'task'
      break
    case 'task':
    default:
      winner = 'task'
      break
  }

  // The winning side keeps its values; the
  // losing side receives a patch.
  if (winner === 'task') {
    const eventPatch: ConflictResolution['eventPatch'] = {}
    if (conflict.differences.includes('name')) {
      eventPatch.summary = task.name
    }
    if (
      conflict.differences.includes('date') &&
      task.date
    ) {
      eventPatch.start = eventStartOn(
        event,
        task.date.slice(0, 10)
      )
    }
    return { conflict, winner, eventPatch, taskPatch: {} }
  }

  const taskPatch: ConflictResolution['taskPatch'] = {}
  if (conflict.differences.includes('name')) {
    taskPatch.name = event.summary ?? task.name
  }
  if (conflict.differences.includes('date')) {
    const eventDate = eventDatePart(event)
    if (eventDate) {
      taskPatch.date = eventDate
    }
  }
  return { conflict, winner, eventPatch: {}, taskPatch }
}

/** Resolve every conflict with one strategy. */
export function resolveConflicts(
  conflicts: CalendarConflict[],
  strategy: ConflictStrategy
): ConflictResolution[] {
  return conflicts.map((conflict) =>
    resolveConflict(conflict, strategy)
  )
}
