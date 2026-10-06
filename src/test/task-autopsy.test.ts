import { generateTaskAutopsy, findStalledTasks } from '@/lib/task-autopsy'
import type { Task, TaskLog } from '@/types'
import { COMPLETION_MILESTONES } from '@/lib/completion-milestones'

/** Create a minimal Task object for testing. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Test Task',
    description: null,
    date: null,
    deadline: null,
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
    details: 'Updated: name',
    created_at: '2025-01-10T00:00:00.000Z',
    ...log,
  }
}

describe('generateTaskAutopsy', () => {
  describe('healthy tasks', () => {
    it('does not flag a task with no issues', () => {
      const task = makeTask({
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        logs: [],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(false)
      expect(autopsy.findings).toHaveLength(0)
      expect(autopsy.recommendations).toHaveLength(0)
    })

    it('does not flag a recently created completed task', () => {
      const task = makeTask({
        completed: true,
        created_at: '2025-01-05T00:00:00.000Z',
        updated_at: '2025-01-05T00:00:00.000Z',
        logs: [makeLog({ action: 'created', details: 'Task created' })],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(false)
    })
  })

  describe('deadline thrash', () => {
    it('flags deadline thrashing at 3+ pushes', () => {
      const task = makeTask({
        logs: [
          makeLog({ action: 'updated', details: 'Updated: deadline', created_at: '2025-01-02T10:00:00.000Z' }),
          makeLog({ action: 'updated', details: 'Updated: deadline', created_at: '2025-01-04T10:00:00.000Z' }),
          makeLog({ action: 'updated', details: 'Updated: deadline', created_at: '2025-01-06T10:00:00.000Z' }),
        ],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(true)
      expect(autopsy.deadlinePushes).toBe(3)
      expect(autopsy.findings.some((f) => f.type === 'deadline_thrash')).toBe(true)
    })

    it('does not flag deadline changes below threshold', () => {
      const task = makeTask({
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        logs: [
          makeLog({ action: 'updated', details: 'Updated: deadline', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }),
          makeLog({ action: 'updated', details: 'Updated: deadline', created_at: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString() }),
        ],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(false)
    })
  })

  describe('repeated reopening', () => {
    it('flags tasks reopened 2+ times', () => {
      const task = makeTask({
        created_at: '2025-01-01T00:00:00.000Z',
        logs: [
          makeLog({ action: 'created', details: 'Task created', created_at: '2025-01-01T00:00:00.000Z' }),
          makeLog({ action: 'completed', details: 'Task completed', created_at: '2025-01-03T00:00:00.000Z' }),
          makeLog({ action: 'reopened', details: 'Task reopened', created_at: '2025-01-05T00:00:00.000Z' }),
          makeLog({ action: 'completed', details: 'Task completed', created_at: '2025-01-07T00:00:00.000Z' }),
          makeLog({ action: 'reopened', details: 'Task reopened', created_at: '2025-01-09T00:00:00.000Z' }),
        ],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(true)
      expect(autopsy.reopenCount).toBe(2)
      expect(autopsy.findings.some((f) => f.type === 'reopened_repeatedly')).toBe(true)
    })
  })

  describe('update churn', () => {
    it('flags tasks with 5+ updates and still incomplete', () => {
      const logs = Array.from({ length: 5 }, (_, i) =>
        makeLog({
          action: 'updated',
          details: `Updated: field${i}`,
          created_at: `2025-01-0${i + 1}T00:00:00.000Z`,
        })
      )
      const task = makeTask({ logs })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(true)
      expect(autopsy.updateCount).toBe(5)
      expect(autopsy.findings.some((f) => f.type === 'update_churn')).toBe(true)
    })
  })

  describe('long stall', () => {
    it('flags tasks open for 7+ days', () => {
      const sevenDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      const task = makeTask({
        created_at: sevenDaysAgo,
        logs: [],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(true)
      expect(autopsy.daysOpen).toBeGreaterThanOrEqual(7)
      expect(autopsy.findings.some((f) => f.type === 'long_stall')).toBe(true)
    })
  })

  describe('no recent progress', () => {
    it('flags tasks with no activity in 3+ days', () => {
      // Mock current date to be Jan 10, 2025
      const realDate = Date.now
      const mockNow = new Date('2025-01-10T12:00:00.000Z').getTime()
      Date.now = jest.fn(() => mockNow)

      const task = makeTask({
        created_at: '2025-01-01T00:00:00.000Z',
        // All logs are from >3 days ago (before Jan 7)
        logs: [
          makeLog({ action: 'updated', details: 'Updated: name', created_at: '2025-01-02T00:00:00.000Z' }),
          makeLog({ action: 'updated', details: 'Updated: deadline', created_at: '2025-01-03T00:00:00.000Z' }),
          makeLog({ action: 'updated', details: 'Updated: priority', created_at: '2025-01-04T00:00:00.000Z' }),
          makeLog({ action: 'updated', details: 'Updated: list', created_at: '2025-01-05T00:00:00.000Z' }),
        ],
      })

      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(true)
      expect(autopsy.findings.some((f) => f.type === 'no_progress')).toBe(true)

      Date.now = realDate
    })
  })

  describe('overestimated', () => {
    it('flags tasks where actual_time exceeds 2x estimate', () => {
      const task = makeTask({
        estimate: 30,
        actual_time: 90,
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.stalled).toBe(true)
      expect(autopsy.findings.some((f) => f.type === 'overestimated')).toBe(true)
    })

    it('does not flag when actual_time is within expected range', () => {
      const task = makeTask({
        estimate: 60,
        actual_time: 60,
        logs: [],
      })
      const autopsy = generateTaskAutopsy(task)

      // Even if estimate matches, long stall with no logs can flag no_progress
      // But with no logs and recent creation, it shouldn't flag
      const recentTask = makeTask({
        estimate: 60,
        actual_time: 60,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        logs: [],
      })
      const recentAutopsy = generateTaskAutopsy(recentTask)
      expect(recentAutopsy.stalled).toBe(false)
    })
  })

  describe('recommendations', () => {
    it('suggests decompose for churn-heavy tasks', () => {
      const logs = Array.from({ length: 5 }, (_, i) =>
        makeLog({ action: 'updated', details: `Updated: field${i}` })
      )
      const task = makeTask({ logs })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.recommendations.some((r) => r.action === 'decompose')).toBe(true)
    })

    it('suggests template for 5+ deadline pushes', () => {
      const logs = Array.from({ length: 5 }, (_, i) =>
        makeLog({
          action: 'updated',
          details: 'Updated: deadline',
          created_at: `2025-01-0${i + 1}T00:00:00.000Z`,
        })
      )
      const task = makeTask({ logs })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.recommendations.some((r) => r.action === 'template')).toBe(true)
    })

    it('deduplicates recommendations', () => {
      const logs = Array.from({ length: 5 }, (_, i) =>
        makeLog({ action: 'updated', details: `Updated: field${i}` })
      )
      const task = makeTask({ logs })
      const autopsy = generateTaskAutopsy(task)

      const actions = autopsy.recommendations.map((r) => r.action)
      const unique = new Set(actions)
      expect(actions.length).toBe(unique.size)
    })
  })

  describe('metadata', () => {
    it('counts update entries correctly', () => {
      const task = makeTask({
        logs: [
          makeLog({ action: 'created', details: 'Task created' }),
          makeLog({ action: 'updated', details: 'Updated: name' }),
          makeLog({ action: 'updated', details: 'Updated: deadline' }),
          makeLog({ action: 'completed', details: 'Task completed' }),
        ],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.updateCount).toBe(2)
    })

    it('counts deadline pushes correctly', () => {
      const task = makeTask({
        logs: [
          makeLog({ action: 'updated', details: 'Updated: deadline' }),
          makeLog({ action: 'updated', details: 'Updated: Deadline' }),
          makeLog({ action: 'updated', details: 'Updated: DEADLINE' }),
          makeLog({ action: 'updated', details: 'Updated: priority' }),
        ],
      })
      const autopsy = generateTaskAutopsy(task)

      expect(autopsy.deadlinePushes).toBe(3)
    })
  })
})

describe('findStalledTasks', () => {
  it('returns only tasks with findings', () => {
    const healthyTask = makeTask({
      id: 'healthy',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      logs: [],
    })
    const stalledTask = makeTask({
      id: 'stalled',
      created_at: '2025-01-01T00:00:00.000Z',
      logs: Array.from({ length: 5 }, (_, i) =>
        makeLog({ action: 'updated', details: `Updated: field${i}` })
      ),
    })

    const results = findStalledTasks([healthyTask, stalledTask])

    expect(results).toHaveLength(1)
    expect(results[0].task.id).toBe('stalled')
    expect(results[0].autopsy.stalled).toBe(true)
  })

  it('returns empty array when all tasks are healthy', () => {
    const results = findStalledTasks([])
    expect(results).toHaveLength(0)
  })
})
