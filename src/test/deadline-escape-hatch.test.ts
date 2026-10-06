import { checkDeadlineEscapeHatch, findDeadlineThrash } from '@/lib/deadline-escape-hatch'
import type { Task, TaskLog } from '@/types'

/**
 * Create a minimal Task object with optional logs and subtasks.
 */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Test Task',
    description: null,
    date: null,
    deadline: '2025-01-15',
    estimate: null,
    actual_time: 0,
    priority: 'none',
    recurring: 'none',
    list_id: null,
    source: null,
    mood: null,
    parent_task_id: null,
    completed: false,
    completed_at: null,
    position: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-10T00:00:00.000Z',
    ...overrides,
  }
}

function makeLog(log: Partial<TaskLog> = {}): TaskLog {
  return {
    id: 'log-1',
    task_id: 'task-1',
    action: 'updated',
    details: 'Updated: deadline',
    created_at: '2025-01-10T00:00:00.000Z',
    ...log,
  }
}

describe('checkDeadlineEscapeHatch', () => {
  it('does not trigger with zero deadline changes', () => {
    const task = makeTask()
    const result = checkDeadlineEscapeHatch(task, [])

    expect(result.triggered).toBe(false)
    expect(result.pushCount).toBe(0)
    expect(result.suggestion).toBe('accept')
    expect(result.currentDeadline).toBe('2025-01-15')
  })

  it('does not trigger with 2 deadline changes (below threshold)', () => {
    const task = makeTask()
    const logs = [
      makeLog({ details: 'Updated: deadline', created_at: '2025-01-05T10:00:00.000Z' }),
      makeLog({ details: 'Updated: deadline', created_at: '2025-01-08T10:00:00.000Z' }),
    ]

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(false)
    expect(result.pushCount).toBe(2)
    expect(result.reason).toContain('2 times')
  })

  it('triggers at exactly 3 deadline changes (threshold met)', () => {
    const task = makeTask()
    const logs = [
      makeLog({ details: 'Updated: deadline', created_at: '2025-01-02T10:00:00.000Z' }),
      makeLog({ details: 'Updated: deadline', created_at: '2025-01-05T10:00:00.000Z' }),
      makeLog({ details: 'Updated: deadline', created_at: '2025-01-08T10:00:00.000Z' }),
    ]

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(true)
    expect(result.pushCount).toBe(3)
  })

  it('suggests renegotiate for 3-4 pushes on a task with no incomplete subtasks', () => {
    const task = makeTask()
    const logs = Array.from({ length: 3 }, (_, i) =>
      makeLog({ details: 'Updated: deadline', created_at: `2025-01-0${i + 1}T10:00:00.000Z` })
    )

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(true)
    expect(result.suggestion).toBe('renegotiate')
    expect(result.reason).toContain('3 times')
  })

  it('suggests decompose when there are incomplete subtasks', () => {
    const task = makeTask({
      sub_tasks: [
        makeTask({ id: 'sub-1', name: 'Subtask 1', completed: false }),
        makeTask({ id: 'sub-2', name: 'Subtask 2', completed: true }),
      ],
    })
    const logs = Array.from({ length: 3 }, (_, i) =>
      makeLog({ details: 'Updated: deadline', created_at: `2025-01-0${i + 1}T10:00:00.000Z` })
    )

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(true)
    expect(result.suggestion).toBe('decompose')
    expect(result.reason).toContain('subtasks')
    expect(result.reason).toContain('1 complete')
  })

  it('suggests template when 5+ pushes and no incomplete subtasks', () => {
    const task = makeTask({
      sub_tasks: [
        makeTask({ id: 'sub-1', name: 'Subtask 1', completed: true }),
      ],
    })
    const logs = Array.from({ length: 5 }, (_, i) =>
      makeLog({ details: 'Updated: deadline', created_at: `2025-01-0${i + 1}T10:00:00.000Z` })
    )

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(true)
    expect(result.suggestion).toBe('template')
    expect(result.reason).toContain('5 times')
  })

  it('ignores log entries that are not "updated" with deadline in details', () => {
    const task = makeTask()
    const logs = [
      makeLog({ action: 'completed', details: 'Task completed' }),
      makeLog({ action: 'updated', details: 'Updated: priority' }),
      makeLog({ action: 'updated', details: 'Updated: deadline' }),
      makeLog({ action: 'updated', details: 'Updated: deadline' }),
      makeLog({ action: 'updated', details: 'Updated: deadline' }),
    ]

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(true)
    expect(result.pushCount).toBe(3)
  })

  it('detects case-insensitive "deadline" in log details', () => {
    const task = makeTask()
    const logs = [
      makeLog({ details: 'Updated: deadline' }),
      makeLog({ details: 'Updated: DeadLine' }),
      makeLog({ details: 'updated: DEADLINE' }),
    ]

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(true)
    expect(result.pushCount).toBe(3)
  })

  it('falls back to task.logs when no logs provided', () => {
    const task = makeTask({
      logs: Array.from({ length: 4 }, () =>
        makeLog({ details: 'Updated: deadline' })
      ),
    })

    const result = checkDeadlineEscapeHatch(task)

    expect(result.triggered).toBe(true)
    expect(result.pushCount).toBe(4)
  })

  it('handles task with no deadline changes in logs', () => {
    const task = makeTask()
    const logs = [
      makeLog({ action: 'updated', details: 'Updated: priority' }),
      makeLog({ action: 'completed', details: 'Task completed' }),
    ]

    const result = checkDeadlineEscapeHatch(task, logs)

    expect(result.triggered).toBe(false)
    expect(result.pushCount).toBe(0)
  })

  it('handles empty logs array', () => {
    const task = makeTask()
    const result = checkDeadlineEscapeHatch(task, [])

    expect(result.triggered).toBe(false)
    expect(result.pushCount).toBe(0)
  })
})

describe('findDeadlineThrash', () => {
  it('returns only tasks that have triggered the escape hatch', () => {
    const normalTask = makeTask({ id: 'normal' })
    const thrashedTask = makeTask({ id: 'thrashed' })

    const tasks: Task[] = [
      {
        ...normalTask,
        logs: [makeLog({ details: 'Updated: priority' })],
      },
      {
        ...thrashedTask,
        logs: Array.from({ length: 3 }, () =>
          makeLog({ details: 'Updated: deadline' })
        ),
      },
    ]

    const results = findDeadlineThrash(tasks)

    expect(results).toHaveLength(1)
    expect(results[0].task.id).toBe('thrashed')
    expect(results[0].hutch.triggered).toBe(true)
    expect(results[0].hutch.pushCount).toBe(3)
  })

  it('returns empty array when no tasks have thrashed', () => {
    const tasks: Task[] = [
      makeTask({ id: 'task-1', logs: [makeLog({ details: 'Updated: priority' })] }),
      makeTask({ id: 'task-2', logs: [makeLog({ details: 'Updated: deadline' })] }),
    ]

    const results = findDeadlineThrash(tasks)

    expect(results).toHaveLength(0)
  })

  it('returns empty array for empty task list', () => {
    const results = findDeadlineThrash([])
    expect(results).toHaveLength(0)
  })
})
