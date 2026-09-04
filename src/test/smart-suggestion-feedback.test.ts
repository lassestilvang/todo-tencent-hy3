import {
  acceptSuggestion,
  isSuggestionAccepted,
  dismissSuggestion,
  isSuggestionDismissed,
  getSuggestionFeedbackStats,
  generateSmartSuggestions,
  FEEDBACK_MIN_SAMPLES,
  FEEDBACK_MIN_ACCEPTANCE_RATE,
} from '@/lib/smart-suggestions'
import type { Task, List } from '@/types'

const DISMISSED_KEY = 'taskflow_dismissed_suggestions'
const ACCEPTED_KEY = 'taskflow_accepted_suggestions'

// Three tasks with the same name created on Mondays at 9am
// produce a "schedule" suggestion (pattern frequency >= 3).
function recurringTask(name: string, createdAt: string): Task {
  return {
    id: `task-${name}-${createdAt}`,
    name,
    description: null,
    date: null,
    deadline: null,
    estimate: 30,
    actual_time: 0,
    priority: 'medium',
    recurring: 'every_week',
    list_id: 'inbox',
    parent_task_id: null,
    completed: false,
    completed_at: null,
    position: 0,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

function fixtureTasks(): Task[] {
  return [
    recurringTask('weekly review', '2026-09-21T09:00:00'),
    recurringTask('weekly review', '2026-09-28T09:00:00'),
    recurringTask('weekly review', '2026-10-05T09:00:00'),
  ]
}

const lists: List[] = [
  {
    id: 'inbox',
    name: 'Inbox',
    color: '#6366f1',
    emoji: '📥',
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  } as List,
]

function generate(): ReturnType<typeof generateSmartSuggestions> {
  const tasks = fixtureTasks()
  return generateSmartSuggestions(tasks, lists, tasks.filter((t) => !t.completed))
}

describe('Suggestion acceptance tracking', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should record an acceptance with its type', () => {
    acceptSuggestion({ id: 'schedule-weekly review', type: 'schedule' })

    expect(isSuggestionAccepted('schedule-weekly review')).toBe(true)
    expect(isSuggestionAccepted('schedule-other')).toBe(false)

    const stats = getSuggestionFeedbackStats()
    expect(stats.totalAccepted).toBe(1)
    expect(stats.totalDismissed).toBe(0)
    expect(stats.acceptanceRate).toBe(1)
    expect(stats.byType.schedule).toMatchObject({
      type: 'schedule',
      accepted: 1,
      dismissed: 0,
      total: 1,
      acceptanceRate: 1,
    })
  })

  it('should not record the same acceptance twice', () => {
    acceptSuggestion({ id: 'schedule-weekly review', type: 'schedule' })
    acceptSuggestion({ id: 'schedule-weekly review', type: 'schedule' })

    expect(getSuggestionFeedbackStats().totalAccepted).toBe(1)
  })

  it('should keep acceptance and dismissal logs separate', () => {
    acceptSuggestion({ id: 'schedule-weekly review', type: 'schedule' })

    expect(isSuggestionDismissed('schedule-weekly review')).toBe(false)
    expect(JSON.parse(localStorage.getItem(ACCEPTED_KEY) || '[]')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')).toHaveLength(0)
  })

  it('should store the type of a dismissed suggestion', () => {
    dismissSuggestion('schedule-run', 'schedule')

    expect(isSuggestionDismissed('schedule-run')).toBe(true)

    const stats = getSuggestionFeedbackStats()
    expect(stats.totalDismissed).toBe(1)
    expect(stats.byType.schedule).toMatchObject({ accepted: 0, dismissed: 1 })
  })

  it('should still load dismissals stored in the old format', () => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(['schedule-old']))

    expect(isSuggestionDismissed('schedule-old')).toBe(true)

    // Old entries carry no type, so they count towards the
    // overall rate but not towards a per-type rate.
    const stats = getSuggestionFeedbackStats()
    expect(stats.totalDismissed).toBe(1)
    expect(stats.byType.schedule).toBeUndefined()
  })

  it('should ignore corrupt feedback storage', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    localStorage.setItem(DISMISSED_KEY, '{not json')
    localStorage.setItem(ACCEPTED_KEY, 'nope')

    try {
      expect(isSuggestionDismissed('anything')).toBe(false)
      expect(isSuggestionAccepted('anything')).toBe(false)

      const stats = getSuggestionFeedbackStats()
      expect(stats.totalAccepted).toBe(0)
      expect(stats.totalDismissed).toBe(0)
      expect(stats.acceptanceRate).toBe(0)
      expect(Object.keys(stats.byType)).toHaveLength(0)
    } finally {
      warn.mockRestore()
    }
  })
})

describe('Suggestion feedback loop', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should keep suggestions for types without feedback', () => {
    const suggestions = generate()
    expect(suggestions.some((s) => s.type === 'schedule')).toBe(true)
  })

  it('should keep suggestions when a type is below the sample threshold', () => {
    for (let i = 0; i < FEEDBACK_MIN_SAMPLES - 1; i++) {
      dismissSuggestion(`schedule-sample-${i}`, 'schedule')
    }

    const suggestions = generate()
    expect(suggestions.some((s) => s.type === 'schedule')).toBe(true)
  })

  it('should stop offering a type that is always dismissed', () => {
    for (let i = 0; i < FEEDBACK_MIN_SAMPLES; i++) {
      dismissSuggestion(`schedule-reject-${i}`, 'schedule')
    }

    const suggestions = generate()
    expect(suggestions.filter((s) => s.type === 'schedule')).toHaveLength(0)
  })

  it('should keep offering a type once it has been accepted', () => {
    for (let i = 0; i < FEEDBACK_MIN_SAMPLES; i++) {
      dismissSuggestion(`schedule-mixed-${i}`, 'schedule')
    }
    acceptSuggestion({ id: 'schedule-accepted', type: 'schedule' })

    // 1 acceptance in 4 interactions meets the bar.
    const stats = getSuggestionFeedbackStats()
    expect(stats.byType.schedule?.acceptanceRate).toBeGreaterThanOrEqual(
      FEEDBACK_MIN_ACCEPTANCE_RATE
    )

    const suggestions = generate()
    expect(suggestions.some((s) => s.type === 'schedule')).toBe(true)
  })

  it('should not let feedback for one type affect another', () => {
    for (let i = 0; i < FEEDBACK_MIN_SAMPLES; i++) {
      dismissSuggestion(`energy-reject-${i}`, 'energy')
    }

    const suggestions = generate()
    // The fixture's schedule suggestions are unaffected by
    // the energy feedback.
    expect(suggestions.some((s) => s.type === 'schedule')).toBe(true)
    expect(suggestions.some((s) => s.type === 'energy')).toBe(false)
  })
})
