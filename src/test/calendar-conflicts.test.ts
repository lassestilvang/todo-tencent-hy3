import {
  findConflicts,
  findLinkedEvent,
  resolveConflict,
  resolveConflicts,
} from '@/lib/calendar/conflicts'
import type { CalendarEvent } from '@/lib/calendar'
import type { Task } from '@/types'

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    summary: 'Write report',
    description: 'Q3 numbers',
    start: { dateTime: '2026-10-08T14:00:00Z' },
    end: { dateTime: '2026-10-08T15:00:00Z' },
    updated: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Write report',
    description: null,
    date: '2026-10-08T14:00:00',
    deadline: null,
    estimate: null,
    actual_time: 0,
    priority: 'none',
    recurring: null as unknown as Task['recurring'],
    list_id: 'inbox',
    parent_task_id: null,
    completed: false,
    completed_at: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    // Linked to the `event-1` fixture below.
    source_event_id: 'event-1',
    ...overrides,
  }
}

describe('Linked events', () => {
  it('links an imported task through source_event_id', () => {
    const imported = task({ source_event_id: 'google-1' })
    const events = [
      event({ id: 'other' }),
      event({ id: 'google-1' }),
    ]

    expect(findLinkedEvent(imported, events)?.id).toBe(
      'google-1'
    )
  })

  it('links a native task through the task-{id} convention', () => {
    const native = task({ id: 'task-1' })
    const events = [event({ id: 'task-task-1' })]

    expect(findLinkedEvent(native, events)?.id).toBe(
      'task-task-1'
    )
  })

  it('prefers the source event over the convention', () => {
    const imported = task({
      id: 'task-1',
      source_event_id: 'google-1',
    })
    const events = [
      event({ id: 'task-task-1', summary: 'Convention' }),
      event({ id: 'google-1', summary: 'Source' }),
    ]

    expect(findLinkedEvent(imported, events)?.summary).toBe(
      'Source'
    )
  })

  it('returns nothing for an unlinked task', () => {
    const unlinked = task({ source_event_id: null })

    expect(findLinkedEvent(unlinked, [event()])).toBeUndefined()
  })
})

describe('Conflict detection', () => {
  it('finds no conflict when task and event agree', () => {
    const conflicts = findConflicts([task()], [event()])

    expect(conflicts).toEqual([])
  })

  it('detects a name difference', () => {
    const conflicts = findConflicts(
      [task()],
      [event({ summary: 'Write the report' })]
    )

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].differences).toEqual(['name'])
    expect(conflicts[0].taskId).toBe('task-1')
    expect(conflicts[0].eventId).toBe('event-1')
  })

  it('detects a date difference', () => {
    const conflicts = findConflicts(
      [task()],
      [event({ start: { dateTime: '2026-10-09T14:00:00Z' } })]
    )

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].differences).toEqual(['date'])
  })

  it('detects both differences at once', () => {
    const conflicts = findConflicts(
      [task({ name: 'Draft report', date: '2026-10-05' })],
      [
        event({
          summary: 'Write report',
          start: { dateTime: '2026-10-09T14:00:00Z' },
        }),
      ]
    )

    expect(conflicts[0].differences).toEqual([
      'name',
      'date',
    ])
  })

  it('ignores completed tasks', () => {
    const conflicts = findConflicts(
      [task({ completed: true })],
      [event({ summary: 'Renamed' })]
    )

    expect(conflicts).toEqual([])
  })

  it('ignores tasks without a linked event', () => {
    const conflicts = findConflicts(
      [task()],
      [event({ id: 'unrelated' })]
    )

    expect(conflicts).toEqual([])
  })
})

describe('Conflict resolution', () => {
  function diverged(): ReturnType<typeof findConflicts> {
    return findConflicts(
      [task({ name: 'Draft report', date: '2026-10-05' })],
      [
        event({
          summary: 'Write report',
          start: { dateTime: '2026-10-09T14:00:00Z' },
        }),
      ]
    )
  }

  it('lets the task win with the task strategy', () => {
    const [resolution] = resolveConflicts(
      diverged(),
      'task'
    )

    expect(resolution.winner).toBe('task')
    expect(resolution.eventPatch).toEqual({
      summary: 'Draft report',
      start: { dateTime: '2026-10-05T14:00:00Z' },
    })
    expect(resolution.taskPatch).toEqual({})
  })

  it('keeps the event time of day when moving its date', () => {
    const [conflict] = diverged()

    const resolution = resolveConflict(conflict, 'task')

    // The event starts at 14:00Z; the patch moves
    // it to the task's date at the same time.
    expect(resolution.eventPatch.start).toEqual({
      dateTime: '2026-10-05T14:00:00Z',
    })
  })

  it('lets the calendar win with the calendar strategy', () => {
    const [resolution] = resolveConflicts(
      diverged(),
      'calendar'
    )

    expect(resolution.winner).toBe('calendar')
    expect(resolution.taskPatch).toEqual({
      name: 'Write report',
      date: '2026-10-09',
    })
    expect(resolution.eventPatch).toEqual({})
  })

  it('lets the newer side win with the newest strategy', () => {
    const [conflict] = diverged()

    // The event was updated after the task.
    const eventWins = resolveConflict(
      {
        ...conflict,
        task: { ...conflict.task, updated_at: '2026-10-01T00:00:00Z' },
        event: { ...conflict.event, updated: '2026-10-05T00:00:00Z' },
      },
      'newest'
    )
    expect(eventWins.winner).toBe('calendar')

    // The task was updated after the event.
    const taskWins = resolveConflict(
      {
        ...conflict,
        task: { ...conflict.task, updated_at: '2026-10-06T00:00:00Z' },
        event: { ...conflict.event, updated: '2026-10-05T00:00:00Z' },
      },
      'newest'
    )
    expect(taskWins.winner).toBe('task')
  })

  it('breaks newest-strategy ties in favor of the task', () => {
    const [conflict] = diverged()

    const resolution = resolveConflict(conflict, 'newest')

    // Both sides carry the same timestamp.
    expect(resolution.winner).toBe('task')
  })

  it('resolves every conflict with one call', () => {
    const conflicts = findConflicts(
      [
        task({ id: 'a', name: 'Diverged a' }),
        task({ id: 'b', name: 'Same' }),
      ],
      [
        event({ id: 'task-a', summary: 'Event a' }),
        event({ id: 'task-b', summary: 'Same' }),
      ]
    )

    const resolutions = resolveConflicts(conflicts, 'task')

    expect(resolutions).toHaveLength(1)
    expect(resolutions[0].conflict.taskId).toBe('a')
  })
})
