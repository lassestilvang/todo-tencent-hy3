import {
  suggestTemplates,
  TEMPLATE_MIN_OCCURRENCES,
} from '@/lib/template-suggestions'
import type { Task } from '@/types'

function task(
  name: string,
  createdAt: string,
  overrides: Partial<Task> = {}
): Task {
  return {
    id: `task-${name}-${createdAt}`,
    name,
    description: null,
    date: null,
    deadline: null,
    estimate: null,
    actual_time: 0,
    priority: 'medium',
    // The store writes null for non-recurring tasks
    // even though the type does not include it.
    recurring: null as unknown as Task['recurring'],
    list_id: 'inbox',
    parent_task_id: null,
    completed: false,
    completed_at: null,
    position: 0,
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  }
}

describe('Template suggestions', () => {
  it('should suggest tasks created at least the threshold times', () => {
    const suggestions = suggestTemplates([
      task('team standup notes', '2026-09-01T09:00:00'),
      task('team standup notes', '2026-09-08T09:00:00'),
      task('team standup notes', '2026-09-15T09:00:00'),
    ])

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      name: 'team standup notes',
      occurrences: 3,
      listId: 'inbox',
      priority: 'medium',
    })
  })

  it('should not suggest tasks below the threshold', () => {
    const suggestions = suggestTemplates([
      task('one-off chore', '2026-09-01T09:00:00'),
      task('one-off chore', '2026-09-08T09:00:00'),
    ])

    expect(suggestions).toHaveLength(0)
  })

  it('should skip recurring tasks', () => {
    const suggestions = suggestTemplates([
      task('water plants', '2026-09-01T09:00:00', { recurring: 'every_week' }),
      task('water plants', '2026-09-08T09:00:00', { recurring: 'every_week' }),
      task('water plants', '2026-09-15T09:00:00', { recurring: 'every_week' }),
      task('water plants', '2026-09-22T09:00:00', { recurring: 'every_week' }),
    ])

    // Recurring tasks generate their own next
    // occurrence, so they never need a template.
    expect(suggestions).toHaveLength(0)
  })

  it('should skip names that already have a template', () => {
    const suggestions = suggestTemplates(
      [
        task('expense report', '2026-09-01T09:00:00'),
        task('expense report', '2026-09-08T09:00:00'),
        task('expense report', '2026-09-15T09:00:00'),
      ],
      [{ name: 'Expense Report' }]
    )

    expect(suggestions).toHaveLength(0)
  })

  it('should group name variants case-insensitively', () => {
    const suggestions = suggestTemplates([
      task('Gym', '2026-09-01T09:00:00'),
      task('gym ', '2026-09-08T09:00:00'),
      task('GYM', '2026-09-15T09:00:00'),
    ])

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].occurrences).toBe(3)
  })

  it('should use the most common list and priority', () => {
    const suggestions = suggestTemplates([
      task('invoice client', '2026-09-01T09:00:00', {
        list_id: 'finance',
        priority: 'high',
      }),
      task('invoice client', '2026-09-08T09:00:00', {
        list_id: 'finance',
        priority: 'high',
      }),
      task('invoice client', '2026-09-15T09:00:00', {
        list_id: 'inbox',
        priority: 'low',
      }),
    ])

    expect(suggestions[0].listId).toBe('finance')
    expect(suggestions[0].priority).toBe('high')
  })

  it('should average the estimates of the occurrences', () => {
    const suggestions = suggestTemplates([
      task('code review', '2026-09-01T09:00:00', { estimate: 20 }),
      task('code review', '2026-09-08T09:00:00', { estimate: 40 }),
      task('code review', '2026-09-15T09:00:00', { estimate: 30 }),
    ])

    expect(suggestions[0].estimate).toBe(30)
  })

  it('should report a null estimate when never estimated', () => {
    const suggestions = suggestTemplates([
      task('untracked chore', '2026-09-01T09:00:00'),
      task('untracked chore', '2026-09-08T09:00:00'),
      task('untracked chore', '2026-09-15T09:00:00'),
    ])

    expect(suggestions[0].estimate).toBeNull()
  })

  it('should track when the name was first and last seen', () => {
    const suggestions = suggestTemplates([
      task('retro action items', '2026-09-01T09:00:00'),
      task('retro action items', '2026-10-01T09:00:00'),
      task('retro action items', '2026-09-15T09:00:00'),
    ])

    expect(suggestions[0].firstSeen).toBe('2026-09-01T09:00:00')
    expect(suggestions[0].lastSeen).toBe('2026-10-01T09:00:00')
  })

  it('should sort by occurrences descending', () => {
    const suggestions = suggestTemplates([
      task('often', '2026-09-01T09:00:00'),
      task('often', '2026-09-02T09:00:00'),
      task('often', '2026-09-03T09:00:00'),
      task('often', '2026-09-04T09:00:00'),
      task('sometimes', '2026-09-01T09:00:00'),
      task('sometimes', '2026-09-02T09:00:00'),
      task('sometimes', '2026-09-03T09:00:00'),
    ])

    expect(suggestions.map((s) => s.name)).toEqual(['often', 'sometimes'])
  })

  it('should return nothing for an empty task list', () => {
    expect(suggestTemplates([])).toEqual([])
  })

  it('should use the configured occurrence threshold', () => {
    // The threshold is the boundary: one fewer occurrence
    // than the threshold must not be suggested.
    const tasks = Array.from(
      { length: TEMPLATE_MIN_OCCURRENCES - 1 },
      (_, i) => task('boundary task', `2026-09-0${i + 1}T09:00:00`)
    )

    expect(suggestTemplates(tasks)).toHaveLength(0)
  })
})
