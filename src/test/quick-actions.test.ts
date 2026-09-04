import {
  BULK_DATE_PRESETS,
  deriveQuickActions,
  findCompletedTasks,
  findHighPriorityDueTasks,
  findOverdueTasks,
  findUnplannedHighPriorityTasks,
  resolveBulkDate,
  toSnapshot,
  type TaskSnapshot,
} from '@/lib/quick-actions'
import type { Task } from '@/types'

// 2026-10-06 is a Tuesday; the windows below are
// relative to it.
const TODAY = '2026-10-06'
const TOMORROW = '2026-10-07'
const YESTERDAY = '2026-10-05'
const NEXT_WEEK = '2026-10-13'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Write report',
    description: null,
    date: null,
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
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  }
}

describe('Snapshots', () => {
  it('narrows a task to the fields the panel needs', () => {
    const snapshot = toSnapshot(
      task({
        id: 't1',
        name: 'Plan launch',
        completed: true,
        priority: 'high',
        date: `${TODAY}T09:00:00`,
        deadline: '2026-10-08',
      }),
    )

    expect(snapshot).toEqual({
      id: 't1',
      name: 'Plan launch',
      completed: true,
      priority: 'high',
      date: `${TODAY}T09:00:00`,
      deadline: '2026-10-08',
    })
  })

  it('maps missing dates to null', () => {
    const snapshot = toSnapshot(task())

    expect(snapshot.date).toBeNull()
    expect(snapshot.deadline).toBeNull()
  })
})

describe('Task finders', () => {
  it('finds completed tasks', () => {
    const tasks = [
      toSnapshot(task({ completed: true })),
      toSnapshot(task({ id: 't2' })),
    ]

    expect(findCompletedTasks(tasks)).toHaveLength(1)
    expect(findCompletedTasks(tasks)[0].id).toBe('task-1')
  })

  it('finds tasks dated or due before today', () => {
    const tasks = [
      toSnapshot(task({ id: 'dated', date: YESTERDAY })),
      toSnapshot(task({ id: 'due', deadline: YESTERDAY })),
      toSnapshot(task({ id: 'future', date: NEXT_WEEK })),
      toSnapshot(task({ id: 'today', date: TODAY })),
      toSnapshot(
        task({ id: 'done', date: YESTERDAY, completed: true }),
      ),
    ]

    const overdue = findOverdueTasks(tasks, TODAY)
    expect(overdue.map((t) => t.id).sort()).toEqual([
      'dated',
      'due',
    ])
  })

  it('finds high-priority tasks due today or overdue', () => {
    const tasks = [
      toSnapshot(
        task({ id: 'due', priority: 'high', date: TODAY }),
      ),
      toSnapshot(
        task({ id: 'overdue', priority: 'high', date: YESTERDAY }),
      ),
      toSnapshot(
        task({ id: 'deadline', priority: 'high', deadline: TODAY }),
      ),
      toSnapshot(
        task({ id: 'future', priority: 'high', date: NEXT_WEEK }),
      ),
      toSnapshot(
        task({ id: 'medium', priority: 'medium', date: TODAY }),
      ),
      toSnapshot(
        task({
          id: 'done',
          priority: 'high',
          date: TODAY,
          completed: true,
        }),
      ),
    ]

    const due = findHighPriorityDueTasks(tasks, TODAY)
    expect(due.map((t) => t.id).sort()).toEqual([
      'deadline',
      'due',
      'overdue',
    ])
  })

  it('finds unplanned high-priority tasks', () => {
    const tasks = [
      toSnapshot(task({ id: 'unplanned', priority: 'high' })),
      toSnapshot(
        task({ id: 'dated', priority: 'high', date: TODAY }),
      ),
      toSnapshot(
        task({ id: 'deadline', priority: 'high', deadline: TODAY }),
      ),
      toSnapshot(task({ id: 'low', priority: 'low' })),
    ]

    const unplanned = findUnplannedHighPriorityTasks(tasks)
    expect(unplanned.map((t) => t.id)).toEqual(['unplanned'])
  })
})

describe('Derived quick actions', () => {
  it('suggests nothing for an empty list', () => {
    expect(deriveQuickActions([], { today: TODAY })).toEqual([])
  })

  it('suggests nothing when nothing matches', () => {
    const tasks = [
      toSnapshot(task({ id: 'future', date: NEXT_WEEK })),
    ]

    expect(deriveQuickActions(tasks, { today: TODAY })).toEqual([])
  })

  it('suggests clearing completed tasks', () => {
    const tasks = [
      toSnapshot(task({ id: 'done', completed: true })),
      toSnapshot(task({ id: 'also-done', completed: true })),
      toSnapshot(task({ id: 'open' })),
    ]

    const actions = deriveQuickActions(tasks, { today: TODAY })
    expect(actions).toHaveLength(1)
    expect(actions[0]).toEqual({
      id: 'clear-completed',
      title: 'Clear 2 completed tasks',
      detail: 'Keep the list focused on what is left',
      count: 2,
      variant: 'destructive',
    })
  })

  it('suggests reviewing and rescheduling overdue tasks', () => {
    const tasks = [
      toSnapshot(task({ id: 'late', date: YESTERDAY })),
    ]

    const actions = deriveQuickActions(tasks, { today: TODAY })
    expect(actions.map((action) => action.id)).toEqual([
      'review-overdue',
      'reschedule-overdue',
    ])
    expect(actions[0].count).toBe(1)
    expect(actions[0].variant).toBe('primary')
    expect(actions[0].href).toBe('/all')
    expect(actions[1].title).toBe(
      'Reschedule 1 overdue task to tomorrow',
    )
  })

  it('pluralizes action titles', () => {
    const tasks = [
      toSnapshot(task({ id: 'a', date: YESTERDAY })),
      toSnapshot(task({ id: 'b', date: YESTERDAY })),
    ]

    const actions = deriveQuickActions(tasks, { today: TODAY })
    expect(actions[0].title).toBe('Review 2 overdue tasks')
  })

  it('suggests finishing high-priority tasks due today', () => {
    const tasks = [
      toSnapshot(
        task({ id: 'urgent', priority: 'high', date: TODAY }),
      ),
    ]

    const actions = deriveQuickActions(tasks, { today: TODAY })
    expect(actions.map((action) => action.id)).toEqual([
      'finish-high-priority',
    ])
    expect(actions[0].variant).toBe('primary')
    expect(actions[0].href).toBe(
      '/all?priority=high&completed=false',
    )
    expect(actions[0].title).toBe(
      'Finish 1 high-priority task',
    )
  })

  it('suggests planning unplanned high-priority tasks', () => {
    const tasks = [
      toSnapshot(task({ id: 'loose', priority: 'high' })),
    ]

    const actions = deriveQuickActions(tasks, { today: TODAY })
    expect(actions.map((action) => action.id)).toEqual([
      'plan-unplanned',
    ])
    expect(actions[0].href).toBe(
      '/all?priority=high&completed=false',
    )
  })

  it('derives every action for a busy list', () => {
    const tasks: TaskSnapshot[] = [
      toSnapshot(task({ id: 'done', completed: true })),
      toSnapshot(task({ id: 'late', date: YESTERDAY })),
      toSnapshot(
        task({ id: 'urgent', priority: 'high', date: TODAY }),
      ),
      toSnapshot(task({ id: 'loose', priority: 'high' })),
      toSnapshot(task({ id: 'later', date: NEXT_WEEK })),
    ]

    const actions = deriveQuickActions(tasks, {
      today: TODAY,
      view: 'today',
    })

    expect(actions.map((action) => action.id)).toEqual([
      'clear-completed',
      'review-overdue',
      'reschedule-overdue',
      'finish-high-priority',
      'plan-unplanned',
    ])
  })

  it('counts each suggestion independently', () => {
    const tasks: TaskSnapshot[] = [
      // Overdue and high-priority: counts for both
      // suggestions, which is correct — they answer
      // different questions.
      toSnapshot(
        task({ id: 'late-urgent', priority: 'high', date: YESTERDAY }),
      ),
    ]

    const actions = deriveQuickActions(tasks, { today: TODAY })
    expect(actions.find((a) => a.id === 'review-overdue')?.count).toBe(1)
    expect(
      actions.find((a) => a.id === 'finish-high-priority')?.count,
    ).toBe(1)
  })
})

describe('Bulk date presets', () => {
  const FIXED = new Date(2026, 9, 6)

  it('exposes the presets the toolbar offers', () => {
    expect(BULK_DATE_PRESETS).toEqual([
      'today',
      'tomorrow',
      'next-week',
      'clear',
    ])
  })

  it('resolves each preset against the reference date', () => {
    expect(resolveBulkDate('today', FIXED)).toBe(TODAY)
    expect(resolveBulkDate('tomorrow', FIXED)).toBe(TOMORROW)
    expect(resolveBulkDate('next-week', FIXED)).toBe(NEXT_WEEK)
    expect(resolveBulkDate('clear', FIXED)).toBeNull()
  })
})
