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
import { tasks as tasksTable } from '@/lib/db/schema'
import type { Task } from '@/types'

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
})
