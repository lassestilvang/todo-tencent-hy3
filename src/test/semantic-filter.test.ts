import {
  rankTasksByQuery,
  semanticFilterTasks,
} from '@/lib/ai/semantic-filter'
import type { Task } from '@/types'

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

// Calibrated hash-embedder similarities (query ||
// haystack): "write report" || "write report" 1.0,
// "write report" || "write the quarterly report"
// 0.49, "write report" || "write the report"
// 0.59, "write report" || "buy groceries" 0.21,
// "report" || "write the report" 0.15,
// "quarterly report" || "chore write the
// quarterly report" 0.28.

describe('Semantic ranking', () => {
  it('returns nothing for an empty query', () => {
    expect(rankTasksByQuery([task()], '')).toEqual([])
    expect(
      rankTasksByQuery([task()], '   ')
    ).toEqual([])
  })

  it('finds tasks that contain the query verbatim', () => {
    const tasks = [
      task({ id: 'report', name: 'Write report' }),
      task({ id: 'groceries', name: 'Buy groceries' }),
    ]

    const results = rankTasksByQuery(tasks, 'write report')

    expect(results.map((r) => r.task.id)).toEqual([
      'report',
    ])
    expect(results[0].exactMatch).toBe(true)
  })

  it('ranks exact matches first', () => {
    const tasks = [
      task({
        id: 'partial',
        name: 'Write the quarterly report',
      }),
      task({ id: 'exact', name: 'Write report' }),
      task({ id: 'unrelated', name: 'Buy groceries' }),
    ]

    const results = rankTasksByQuery(tasks, 'write report')

    // "Write the quarterly report" is semantically
    // close (0.28) and passes the threshold, but the
    // verbatim match scores higher.
    expect(results.map((r) => r.task.id)).toEqual([
      'exact',
      'partial',
    ])
    expect(results[0].score).toBeGreaterThan(
      results[1].score
    )
  })

  it('finds related tasks without a verbatim match', () => {
    const tasks = [
      task({
        id: 'partial',
        name: 'Write the quarterly report',
      }),
      task({ id: 'groceries', name: 'Buy groceries' }),
    ]

    const results = rankTasksByQuery(tasks, 'write report')

    // No task contains "write report" verbatim,
    // but the quarterly report is semantically
    // close (0.49) while groceries are not (0.21).
    expect(results.map((r) => r.task.id)).toEqual([
      'partial'
    ])
    expect(results[0].exactMatch).toBe(false)
  })

  it('keeps every score within 0 and 1', () => {
    const tasks = [
      task({ id: 'a', name: 'Write report' }),
      task({ id: 'b', name: 'Buy groceries' }),
    ]

    for (const result of rankTasksByQuery(tasks, 'report')) {
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
    }
  })

  it('applies the similarity threshold', () => {
    const tasks = [
      task({ id: 'exact', name: 'Write report' }),
      task({
        id: 'partial',
        name: 'Write the quarterly report',
      }),
    ]

    // Only the verbatim match (0.88) clears 0.5.
    const results = rankTasksByQuery(tasks, 'write report', {
      threshold: 0.5,
    })

    expect(results.map((r) => r.task.id)).toEqual(['exact'])
  })

  it('applies the result limit', () => {
    const tasks = [
      task({ id: 'partial', name: 'Write the report' }),
      task({ id: 'exact', name: 'Write report' }),
      task({ id: 'other', name: 'Report on sales' }),
    ]

    const results = rankTasksByQuery(tasks, 'report', {
      limit: 2,
    })

    expect(results).toHaveLength(2)
  })

  it('only ranks tasks matching the base filter', () => {
    const tasks = [
      task({
        id: 'high',
        name: 'Write report',
        priority: 'high',
      }),
      task({
        id: 'low',
        name: 'Write the report draft',
        priority: 'low',
      }),
    ]

    const results = rankTasksByQuery(tasks, 'report', {
      filter: { priority: 'high' },
    })

    expect(results.map((r) => r.task.id)).toEqual(['high'])
  })

  it('returns tasks only, in the same order', () => {
    const tasks = [
      task({ id: 'partial', name: 'Write the report' }),
      task({ id: 'exact', name: 'Write report' }),
    ]

    const filtered = semanticFilterTasks(
      tasks,
      'write report'
    )

    expect(filtered.map((t) => t.id)).toEqual([
      'exact',
      'partial',
    ])
  })

  it('includes descriptions in the comparison', () => {
    const tasks = [
      task({
        id: 'described',
        name: 'Chore',
        description: 'Write the quarterly report',
      }),
    ]

    const results = rankTasksByQuery(tasks, 'quarterly report')

    expect(results.map((r) => r.task.id)).toEqual([
      'described'
    ])
  })
})
