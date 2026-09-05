/**
 * @jest-environment node
 *
 * Performance benchmarks (plan 4.4). Each case times a
 * real code path over a large dataset and asserts a
 * ceiling, so a slowdown fails loudly instead of
 * silently degrading the app. Ceilings are generous
 * regression guards, not tight budgets.
 */
"use strict"

import { testDb, runTestMigrations, initializeTestDatabase } from './db-test'
import { setDbInstanceForTesting, getTasks } from '@/lib/tasks'
import {
  batchPrioritize,
  type UserContext,
} from '@/lib/ai/task-prioritizer'
import { semanticFilterTasks } from '@/lib/ai/semantic-filter'
import { parseFilterQuery } from '@/lib/nl-filter'
import { searchCommands } from '@/lib/command-palette'
import {
  executeWorkflow,
  type Workflow,
  type WorkflowNode,
  type WorkflowEdge,
} from '@/lib/workflows/engine'
import { syncCalendar } from '@/lib/calendar/sync'
import type { CalendarEvent } from '@/lib/calendar'
import { tasks as tasksTable } from '@/lib/db/schema'
import type { Task } from '@/types'

// The Google API is replaced with instant
// responses: this benchmark measures
// TaskFlow's orchestration overhead (task
// loading, conflict detection, resolution,
// and the push/pull loops), not Google's
// network time, which TaskFlow cannot bound.
// Populated in beforeAll from the seeded
// tasks; read lazily by the mock.
const mockCalendarEvents: CalendarEvent[] = []

jest.mock('@/lib/calendar', () => {
  const actual =
    jest.requireActual<
      typeof import('@/lib/calendar')
    >('@/lib/calendar')
  return {
    ...actual,
    getCalendarList: async () => [
      {
        id: 'primary',
        summary: 'Primary',
        primary: true,
        accessRole: 'owner' as const,
      },
    ],
    getEvents: async () => ({
      items: mockCalendarEvents,
    }),
    createEvent: async () => ({
      id: 'created-event',
    }),
    updateEvent: async () => ({}),
  }
})

setDbInstanceForTesting(testDb)

const TASK_COUNT = 10_000

interface Benchmark {
  operation: string
  dataset: string
  ms: number
  ceilingMs: number
}

const CONTEXT: UserContext = {
  energyLevel: 'high',
  availableTimeMinutes: 120,
  focusMode: true,
}

// A trigger feeding a linear chain of action
// nodes — the shape a real automation takes.
const WORKFLOW_NODES = 10

function workflowChain(): Workflow {
  const nodes: WorkflowNode[] = [
    {
      id: 'trigger-1',
      type: 'trigger',
      triggerType: 'task_completed',
      config: {},
      position: { x: 0, y: 0 },
    },
  ]
  const edges: WorkflowEdge[] = []
  for (let i = 0; i < WORKFLOW_NODES; i++) {
    nodes.push({
      id: `action-${i}`,
      type: 'action',
      actionType: 'log_activity',
      config: { message: `step ${i}` },
      position: { x: i + 1, y: 0 },
    })
  }
  edges.push({
    id: 'edge-0',
    source: 'trigger-1',
    target: 'action-0',
  })
  for (let i = 0; i < WORKFLOW_NODES - 1; i++) {
    edges.push({
      id: `edge-${i + 1}`,
      source: `action-${i}`,
      target: `action-${i + 1}`,
    })
  }
  return {
    id: 'perf-workflow',
    name: 'Benchmark workflow',
    description: '',
    nodes,
    edges,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    runCount: 0,
  }
}

// Populated in beforeAll; the AI benchmarks run over mapped Task objects.
let allTasks: Task[] = []
const results: Benchmark[] = []

beforeAll(async () => {
  runTestMigrations()
  initializeTestDatabase()

  const priorities = ['high', 'medium', 'low', 'none'] as const
  const verbs = ['write', 'review', 'ship', 'plan']
  const today = new Date().toISOString().split('T')[0]
  const rows = []
  for (let i = 0; i < TASK_COUNT; i++) {
    const month = i % 2 === 0 ? '10' : '11'
    const day = String(1 + (i % 28)).padStart(2, '0')
    rows.push({
      id: `perf-task-${i}`,
      name: `Benchmark task ${i} — ${verbs[i % 4]} report ${i % 50}`,
      priority: priorities[i % 4],
      // Some tasks are due today so the `today` view
      // and deadline benchmarks have real matches.
      date: i % 7 === 0 ? today : `2026-${month}-${day}`,
      deadline: i % 11 === 0 ? new Date().toISOString() : undefined,
      estimate: (i % 9) * 15,
      listId: 'inbox',
    })
  }
  // Insert in chunks: one 10k-row statement would exceed
  // SQLite's SQL-variable ceiling (rows × columns).
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    testDb
      .insert(tasksTable)
      .values(rows.slice(i, i + CHUNK))
      .run()
  }

  allTasks = await getTasks()

  // Calendar fixtures for the sync benchmark:
  // linked events that diverged from their
  // tasks (exercises conflict detection and
  // resolution) plus foreign events (exercises
  // the pull/import path). The sync only sees
  // the `upcoming` view, so link fixtures to
  // tasks that view contains.
  const upcomingTasks = allTasks.filter(
    (task) => task.date !== null && task.date >= today
  )
  for (let i = 0; i < 50; i++) {
    const task = upcomingTasks[i]
    mockCalendarEvents.push({
      id: `task-${task.id}`,
      summary: `Diverged event ${i}`,
      start: { dateTime: task.date ?? undefined },
      end: { dateTime: task.date ?? undefined },
    })
    const start = new Date(
      Date.now() + (i + 1) * 86_400_000
    )
    mockCalendarEvents.push({
      id: `google-event-${i}`,
      summary: `Imported event ${i}`,
      description: 'Imported from Google',
      start: { dateTime: start.toISOString() },
      end: {
        dateTime: new Date(
          start.getTime() + 3_600_000
        ).toISOString(),
      },
    })
  }
})

afterAll(() => {
  console.table(results)
})

describe('Performance benchmarks', () => {
  it('reads the full task list with relations', async () => {
    const start = performance.now()
    const tasks = await getTasks()
    const ms = performance.now() - start
    results.push({
      operation: 'getTasks()',
      dataset: `${TASK_COUNT} tasks`,
      ms,
      ceilingMs: 3_000,
    })

    expect(tasks).toHaveLength(TASK_COUNT)
    expect(ms).toBeLessThan(3_000)
  })

  it('filters the task list by view', async () => {
    const start = performance.now()
    const tasks = await getTasks({ view: 'today' })
    const ms = performance.now() - start
    results.push({
      operation: 'getTasks({ view: "today" })',
      dataset: `${TASK_COUNT} tasks`,
      ms,
      ceilingMs: 3_000,
    })

    expect(tasks.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(3_000)
  })

  it('searches the task list', async () => {
    const start = performance.now()
    const tasks = await getTasks({ search: 'report 7' })
    const ms = performance.now() - start
    results.push({
      operation: 'getTasks({ search })',
      dataset: `${TASK_COUNT} tasks`,
      ms,
      ceilingMs: 3_000,
    })

    expect(tasks.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(3_000)
  })

  it('prioritizes a large batch', async () => {
    const slice = allTasks.slice(0, 2_000)
    const start = performance.now()
    const ranked = await batchPrioritize(slice, CONTEXT)
    const ms = performance.now() - start
    results.push({
      operation: 'batchPrioritize',
      dataset: '2,000 tasks',
      ms,
      ceilingMs: 3_000,
    })

    expect(ranked).toHaveLength(2_000)
    expect(ranked[0].priority.score).toBeGreaterThanOrEqual(
      ranked[ranked.length - 1].priority.score,
    )
    expect(ms).toBeLessThan(3_000)
  })

  it('semantically filters a large batch', () => {
    const slice = allTasks.slice(0, 2_000)
    const start = performance.now()
    const matches = semanticFilterTasks(slice, 'write report')
    const ms = performance.now() - start
    results.push({
      operation: 'semanticFilterTasks',
      dataset: '2,000 tasks',
      ms,
      ceilingMs: 500,
    })

    expect(matches.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(500)
  })

  it('parses natural-language filters repeatedly', () => {
    const start = performance.now()
    for (let i = 0; i < 500; i++) {
      parseFilterQuery('show high priority tasks due today')
    }
    const ms = performance.now() - start
    results.push({
      operation: 'parseFilterQuery',
      dataset: '500 iterations',
      ms,
      ceilingMs: 200,
    })

    expect(ms).toBeLessThan(200)
  })

  it('searches the command palette repeatedly', () => {
    const start = performance.now()
    for (let i = 0; i < 1_000; i++) {
      searchCommands('comp')
    }
    const ms = performance.now() - start
    results.push({
      operation: 'searchCommands',
      dataset: '1,000 iterations',
      ms,
      ceilingMs: 200,
    })

    expect(ms).toBeLessThan(200)
  })

  it('executes a workflow', async () => {
    const workflow = workflowChain()

    // log_activity writes to the console —
    // silence the benchmark run.
    const log = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)

    const ITERATIONS = 100
    const start = performance.now()
    for (let i = 0; i < ITERATIONS; i++) {
      const { success } = await executeWorkflow(
        workflow,
        { taskId: 'perf-task-0' }
      )
      if (!success) {
        throw new Error('workflow execution failed')
      }
    }
    const ms = performance.now() - start
    log.mockRestore()

    // Per-run overhead: the plan's target is
    // < 100ms for a workflow execution.
    const perRun = ms / ITERATIONS
    results.push({
      operation: 'executeWorkflow',
      dataset: `${WORKFLOW_NODES + 1} nodes × ${ITERATIONS} runs`,
      ms: perRun,
      ceilingMs: 100,
    })

    expect(perRun).toBeLessThan(100)
  })

  it('synchronizes the calendar', async () => {
    const start = performance.now()
    const result = await syncCalendar(
      'benchmark-token',
      { pull: true, conflictStrategy: 'calendar' }
    )
    const ms = performance.now() - start

    results.push({
      operation: 'syncCalendar',
      dataset: `${TASK_COUNT} tasks, ${mockCalendarEvents.length} events (Google API mocked)`,
      ms,
      ceilingMs: 5_000,
    })

    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
    // Half the fixtures are diverged linked
    // events; the other half are new imports.
    expect(result.conflicts).toBe(50)
    expect(result.pulled).toBe(50)
    expect(result.synced).toBeGreaterThan(0)
    // The plan's target: < 5s for a sync
    // cycle, excluding Google's network time.
    expect(ms).toBeLessThan(5_000)
  })
})
