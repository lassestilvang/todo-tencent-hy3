/**
 * Calendar sync orchestration
 *
 * Pushes TaskFlow tasks to Google Calendar and (optionally) pulls
 * Google events back into TaskFlow. Kept free of `next/server`
 * dependencies so it can be unit-tested with a mocked fetch.
 */

import {
  getCalendarList,
  getEvents,
  createEvent,
  updateEvent,
  taskToCalendarEvent,
  calendarEventToTask,
} from '@/lib/calendar'
import { getTasks, getLists, createTask, updateTask } from '@/lib/tasks'
import {
  findConflicts,
  resolveConflicts,
  type ConflictStrategy,
} from './conflicts'

export interface SyncOptions {
  /** Import Google events that are not yet in TaskFlow */
  pull?: boolean
  /** List to import pulled events into (defaults to the first list) */
  listId?: string | null
  /** How diverged task/event pairs are resolved */
  conflictStrategy?: ConflictStrategy
}

export interface SyncResult {
  success: boolean
  /** Tasks pushed to the calendar */
  synced: number
  /** Events imported into TaskFlow */
  pulled: number
  /** Linked pairs whose content had diverged */
  conflicts: number
  errors: string[]
  lastSync: string
  calendar: string
}

export async function syncCalendar(
  accessToken: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  // Get user's calendars
  const calendars = await getCalendarList(accessToken)
  const primaryCalendar = calendars.find(c => c.primary) || calendars[0]

  if (!primaryCalendar) {
    throw new Error('No calendars found')
  }

  // Get tasks from TaskFlow
  const tasks = await getTasks({ view: 'upcoming', completed: false })

  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days

  const { items: existingEvents } = await getEvents(
    accessToken,
    primaryCalendar.id,
    timeMin,
    timeMax
  )

  // Build map of existing events by task ID (the `task-{id}`
  // convention used for events TaskFlow creates itself).
  const eventMap = new Map<string, string>()
  for (const event of existingEvents) {
    if (event.id.startsWith('task-')) {
      const taskId = event.id.replace('task-', '')
      eventMap.set(taskId, event.id)
    }
  }

  // Google event IDs already represented by an imported task.
  const importedEventIds = new Set<string>(
    tasks
      .map(task => task.source_event_id)
      .filter((id): id is string => Boolean(id))
  )

  let synced = 0
  let pulled = 0
  const errors: string[] = []

  // Detect conflicts on the fetched state, before
  // the push below rewrites events from tasks: a
  // linked pair whose name or date diverged.
  const conflicts = findConflicts(tasks, existingEvents)

  if (options.conflictStrategy && conflicts.length > 0) {
    for (const resolution of resolveConflicts(
      conflicts,
      options.conflictStrategy
    )) {
      // A task win is applied by the push loop
      // below; a calendar win must update the
      // task first so the push does not clobber
      // the event with stale task values.
      if (resolution.winner === 'calendar') {
        try {
          // Awaited so a failed write is caught
          // below and reported in errors[].
          await updateTask(
            resolution.conflict.taskId,
            resolution.taskPatch
          )
          // Keep the in-memory task in step with
          // the resolution for the push below.
          Object.assign(
            resolution.conflict.task,
            resolution.taskPatch
          )
        } catch (error) {
          errors.push(
            `Conflict ${resolution.conflict.taskId}: ${
              error instanceof Error
                ? error.message
                : 'Unknown error'
            }`
          )
        }
      }
    }
  }

  // Push: TaskFlow tasks -> Google Calendar
  for (const task of tasks) {
    try {
      const event = taskToCalendarEvent(task)

      // Imported tasks update the Google event they came from;
      // native tasks use the `task-{id}` event.
      const sourceEvent = task.source_event_id
        ? existingEvents.find(e => e.id === task.source_event_id)
        : undefined
      const existingEventId = sourceEvent?.id ?? eventMap.get(task.id)

      if (existingEventId) {
        // Update existing event
        await updateEvent(accessToken, primaryCalendar.id, existingEventId, event)
      } else {
        // Create new event
        await createEvent(accessToken, primaryCalendar.id, event)
      }
      synced++
    } catch (error) {
      errors.push(`Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Pull: Google events -> TaskFlow tasks
  if (options.pull) {
    let targetListId: string | null = options.listId ?? null
    if (!targetListId) {
      const lists = await getLists()
      targetListId = lists[0]?.id ?? null
    }

    for (const event of existingEvents) {
      // Skip events TaskFlow created and events already imported.
      if (event.id.startsWith('task-') || importedEventIds.has(event.id)) {
        continue
      }

      try {
        const candidate = calendarEventToTask(event, targetListId ?? '')
        // Awaited so a failed import is caught
        // here and reported in errors[].
        await createTask({
          ...candidate,
          source_event_id: event.id,
        })
        importedEventIds.add(event.id)
        pulled++
      } catch (error) {
        errors.push(`Event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  return {
    success: true,
    synced,
    pulled,
    conflicts: conflicts.length,
    errors,
    lastSync: new Date().toISOString(),
    calendar: primaryCalendar.summary,
  }
}
