import { predictCompletionTime } from '@/lib/ai/patterns'
import type { Label, Task } from '@/types'

const PATTERNS_KEY = 'taskflow_ai_patterns'

interface CompletedTaskFixture {
  id: string
  name: string
  date: string
  estimate: number
  actualTime: number
  priority: string
  completedAt: string
  dayOfWeek: number
  hourOfDay: number
}

function seedPatterns(
  completedTasks: CompletedTaskFixture[] = [],
  categoryPatterns: Record<string, { averageEstimate: number; averageActual: number; commonTags: string[]; preferredList: string }> = {}
) {
  localStorage.setItem(
    PATTERNS_KEY,
    JSON.stringify({
      completedTasks,
      categoryPatterns,
      modelVersion: 1,
      lastUpdated: Date.now(),
      trainingDataPoints: completedTasks.length,
    })
  )
}

function makeLabel(name: string): Label {
  return { id: `label-${name}`, name, color: '#000000', icon: '', created_at: '' }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Write report',
    description: null,
    date: null,
    deadline: null,
    estimate: 60,
    actual_time: 0,
    priority: 'medium',
    recurring: null,
    list_id: null,
    parent_task_id: null,
    completed: false,
    completed_at: null,
    position: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('predictCompletionTime', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should use the category average when the category is known', () => {
    seedPatterns([], {
      work: {
        averageEstimate: 45,
        averageActual: 90,
        commonTags: ['work'],
        preferredList: 'Work',
      },
    })

    const result = predictCompletionTime(
      makeTask({ labels: [makeLabel('work')] })
    )

    expect(result.predictedMinutes).toBe(90)
    expect(result.confidence).toBe('high')
    expect(result.basis).toBe('category')
  })

  it('should fall back to general category average', () => {
    seedPatterns([], {
      general: {
        averageEstimate: 30,
        averageActual: 45,
        commonTags: [],
        preferredList: 'Inbox',
      },
    })

    const result = predictCompletionTime(makeTask())

    expect(result.predictedMinutes).toBe(45)
    expect(result.basis).toBe('category')
  })

  it('should calibrate the estimate against observed overruns', () => {
    // Three completed tasks: estimates avg 60, actuals avg 120 (2x overrun).
    seedPatterns([
      { id: '1', name: 'a', date: '2026-01-01', estimate: 30, actualTime: 60, priority: 'high', completedAt: '', dayOfWeek: 1, hourOfDay: 9 },
      { id: '2', name: 'b', date: '2026-01-02', estimate: 60, actualTime: 120, priority: 'medium', completedAt: '', dayOfWeek: 2, hourOfDay: 10 },
      { id: '3', name: 'c', date: '2026-01-03', estimate: 90, actualTime: 180, priority: 'low', completedAt: '', dayOfWeek: 3, hourOfDay: 11 },
    ])

    const result = predictCompletionTime(makeTask({ estimate: 60 }))

    expect(result.predictedMinutes).toBe(120)
    expect(result.confidence).toBe('medium')
    expect(result.basis).toBe('calibrated-estimate')
  })

  it('should calibrate against underruns too', () => {
    // Estimates avg 120, actuals avg 60 (0.5x).
    seedPatterns([
      { id: '1', name: 'a', date: '2026-01-01', estimate: 120, actualTime: 60, priority: 'high', completedAt: '', dayOfWeek: 1, hourOfDay: 9 },
      { id: '2', name: 'b', date: '2026-01-02', estimate: 120, actualTime: 60, priority: 'medium', completedAt: '', dayOfWeek: 2, hourOfDay: 10 },
      { id: '3', name: 'c', date: '2026-01-03', estimate: 120, actualTime: 60, priority: 'low', completedAt: '', dayOfWeek: 3, hourOfDay: 11 },
    ])

    const result = predictCompletionTime(makeTask({ estimate: 100 }))

    expect(result.predictedMinutes).toBe(50)
    expect(result.basis).toBe('calibrated-estimate')
  })

  it('should use the raw estimate when history is too thin', () => {
    seedPatterns([
      { id: '1', name: 'a', date: '2026-01-01', estimate: 30, actualTime: 60, priority: 'high', completedAt: '', dayOfWeek: 1, hourOfDay: 9 },
      { id: '2', name: 'b', date: '2026-01-02', estimate: 60, actualTime: 120, priority: 'medium', completedAt: '', dayOfWeek: 2, hourOfDay: 10 },
    ])

    const result = predictCompletionTime(makeTask({ estimate: 45 }))

    expect(result.predictedMinutes).toBe(45)
    expect(result.confidence).toBe('low')
    expect(result.basis).toBe('estimate')
  })

  it('should ignore tasks without an estimate when calibrating', () => {
    // Only two tasks have both estimate and actualTime, so calibration
    // (which needs 3) does not apply; the raw estimate is used instead.
    seedPatterns([
      { id: '1', name: 'a', date: '2026-01-01', estimate: 0, actualTime: 60, priority: 'high', completedAt: '', dayOfWeek: 1, hourOfDay: 9 },
      { id: '2', name: 'b', date: '2026-01-02', estimate: 60, actualTime: 120, priority: 'medium', completedAt: '', dayOfWeek: 2, hourOfDay: 10 },
      { id: '3', name: 'c', date: '2026-01-03', estimate: 0, actualTime: 180, priority: 'low', completedAt: '', dayOfWeek: 3, hourOfDay: 11 },
    ])

    const result = predictCompletionTime(makeTask({ estimate: 30 }))

    expect(result.basis).toBe('estimate')
    expect(result.predictedMinutes).toBe(30)
  })

  it('should return a default when there is no estimate and no history', () => {
    seedPatterns()

    const result = predictCompletionTime(makeTask({ estimate: null }))

    expect(result.predictedMinutes).toBe(30)
    expect(result.confidence).toBe('low')
    expect(result.basis).toBe('default')
  })
})
