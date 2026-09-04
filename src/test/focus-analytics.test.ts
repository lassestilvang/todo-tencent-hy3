import {
  computeHabitMetrics,
  toISODate,
  addDays,
} from '@/lib/focus/habit-metrics'
import {
  loadFocusSessions,
  recordFocusSession,
  clearFocusSessions,
  MAX_SESSIONS,
} from '@/lib/focus/session-log'
import type { FocusSession } from '@/lib/focus/session-log'

function session(date: string, durationMinutes: number, completed: boolean): FocusSession {
  return { date, durationMinutes, completed }
}

describe('Focus habit metrics', () => {
  const now = new Date(2026, 9, 6, 12, 0) // 2026-10-06

  it('should report zeros for an empty log', () => {
    const metrics = computeHabitMetrics([], now)

    expect(metrics.totalSessions).toBe(0)
    expect(metrics.completionRate).toBe(0)
    expect(metrics.totalFocusMinutes).toBe(0)
    expect(metrics.averageSessionMinutes).toBe(0)
    expect(metrics.currentStreak).toBe(0)
    expect(metrics.longestStreak).toBe(0)
    expect(metrics.last7Days).toHaveLength(7)
    expect(metrics.last7Days.every(d => d.minutes === 0)).toBe(true)
  })

  it('should compute completion rate and average session length', () => {
    const metrics = computeHabitMetrics(
      [
        session('2026-10-06', 25, true),
        session('2026-10-06', 25, true),
        session('2026-10-05', 25, false),
      ],
      now
    )

    expect(metrics.totalSessions).toBe(3)
    expect(metrics.completedSessions).toBe(2)
    expect(metrics.abandonedSessions).toBe(1)
    expect(metrics.completionRate).toBeCloseTo(2 / 3)
    expect(metrics.totalFocusMinutes).toBe(50)
    expect(metrics.averageSessionMinutes).toBe(25)
  })

  it('should count a current streak ending today', () => {
    const metrics = computeHabitMetrics(
      [
        session(toISODate(now), 25, true),
        session(toISODate(addDays(now, -1)), 25, true),
        session(toISODate(addDays(now, -2)), 25, true),
      ],
      now
    )

    expect(metrics.currentStreak).toBe(3)
  })

  it('should keep the streak alive when today has no session yet', () => {
    const metrics = computeHabitMetrics(
      [
        session(toISODate(addDays(now, -1)), 25, true),
        session(toISODate(addDays(now, -2)), 25, true),
      ],
      now
    )

    expect(metrics.currentStreak).toBe(2)
  })

  it('should break the streak on a gap day', () => {
    const metrics = computeHabitMetrics(
      [
        session(toISODate(addDays(now, -1)), 25, true),
        // Two-day gap before this one.
        session(toISODate(addDays(now, -4)), 25, true),
        session(toISODate(addDays(now, -5)), 25, true),
      ],
      now
    )

    expect(metrics.currentStreak).toBe(1)
    expect(metrics.longestStreak).toBe(2)
  })

  it('should find the longest historical run', () => {
    const metrics = computeHabitMetrics(
      [
        session(toISODate(addDays(now, -10)), 25, true),
        session(toISODate(addDays(now, -9)), 25, true),
        session(toISODate(addDays(now, -8)), 25, true),
        session(toISODate(addDays(now, -8)), 25, true), // same day, same run
        session(toISODate(now), 25, true),
      ],
      now
    )

    expect(metrics.longestStreak).toBe(3)
    expect(metrics.currentStreak).toBe(1)
  })

  it('should aggregate the last 7 days by calendar day', () => {
    const today = toISODate(now)
    const yesterday = toISODate(addDays(now, -1))
    const metrics = computeHabitMetrics(
      [
        session(today, 30, true),
        session(today, 25, false), // abandoned minutes are not focus time
        session(yesterday, 25, true),
        session('2020-01-01', 25, true), // outside the window
      ],
      now
    )

    expect(metrics.last7Days[6]).toMatchObject({
      date: today,
      minutes: 30,
      sessions: 2,
      completedSessions: 1,
    })
    expect(metrics.last7Days[5]).toMatchObject({
      date: yesterday,
      minutes: 25,
      sessions: 1,
      completedSessions: 1,
    })
    expect(metrics.last7Days.slice(0, 5).every(d => d.sessions === 0)).toBe(true)
  })
})

describe('Focus session log', () => {
  beforeEach(() => {
    clearFocusSessions()
  })

  it('should record and load sessions', () => {
    recordFocusSession(session('2026-10-06', 25, true))
    recordFocusSession(session('2026-10-06', 10, false))

    const loaded = loadFocusSessions()
    expect(loaded).toHaveLength(2)
    expect(loaded[0]).toEqual({ date: '2026-10-06', durationMinutes: 25, completed: true })
    expect(loaded[1].completed).toBe(false)
  })

  it('should trim the log to the retention window', () => {
    for (let i = 0; i < MAX_SESSIONS + 10; i++) {
      recordFocusSession(session('2026-10-06', 25, true))
    }

    expect(loadFocusSessions()).toHaveLength(MAX_SESSIONS)
  })

  it('should drop malformed entries when loading', () => {
    localStorage.setItem(
      'focus-mode-history',
      JSON.stringify([
        { date: '2026-10-06', durationMinutes: 25, completed: true },
        { date: 'nope', durationMinutes: 25 },
        'not-an-object',
        null,
      ])
    )

    const loaded = loadFocusSessions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].date).toBe('2026-10-06')
  })

  it('should return an empty log for corrupt storage', () => {
    localStorage.setItem('focus-mode-history', '{not json')
    expect(loadFocusSessions()).toEqual([])
  })
})
