/**
 * Focus habit metrics
 *
 * Turns the raw focus-session log into habit statistics:
 * completion rate, streaks, and a per-day breakdown for
 * the last week. Pure — pass a fixed `now` to test.
 */

import type { FocusSession } from './session-log'

export interface DayMetrics {
  /** `yyyy-MM-dd` */
  date: string
  /** Minutes of completed sessions that day */
  minutes: number
  /** Sessions started that day */
  sessions: number
  /** Sessions that ran to completion that day */
  completedSessions: number
}

export interface HabitMetrics {
  totalSessions: number
  completedSessions: number
  abandonedSessions: number
  /** Completed sessions / total sessions, 0 when there are none */
  completionRate: number
  /** Minutes of completed sessions */
  totalFocusMinutes: number
  /** Average length of a completed session */
  averageSessionMinutes: number
  /** Consecutive days with a completed session, ending today or yesterday */
  currentStreak: number
  longestStreak: number
  /** Per-day breakdown, oldest first, ending today */
  last7Days: DayMetrics[]
}

/** Local-date `yyyy-MM-dd` for a Date. */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** A Date at local midnight, n calendar days after `date`. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function parseISODate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

/**
 * Streak ending today. A day without a completed session does
 * not break the streak while today itself is still unfinished —
 * the run is counted back from yesterday in that case.
 */
function computeCurrentStreak(
  completedDates: Set<string>,
  now: Date
): number {
  let cursor = completedDates.has(toISODate(now)) ? now : addDays(now, -1)
  let streak = 0
  while (completedDates.has(toISODate(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

function computeLongestStreak(completedDates: Set<string>): number {
  const sorted = [...completedDates].sort()
  let longest = 0
  let run = 0
  let previous = ''

  for (const date of sorted) {
    if (previous && toISODate(addDays(parseISODate(previous), 1)) === date) {
      run++
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    previous = date
  }

  return longest
}

export function computeHabitMetrics(
  sessions: FocusSession[],
  now: Date = new Date()
): HabitMetrics {
  const totalSessions = sessions.length
  const completedSessions = sessions.filter(session => session.completed)
  const abandonedSessions = totalSessions - completedSessions.length
  const completionRate =
    totalSessions > 0 ? completedSessions.length / totalSessions : 0

  const totalFocusMinutes = completedSessions.reduce(
    (sum, session) => sum + session.durationMinutes,
    0
  )
  const averageSessionMinutes =
    completedSessions.length > 0
      ? totalFocusMinutes / completedSessions.length
      : 0

  const completedDates = new Set(completedSessions.map(session => session.date))

  const last7Days: DayMetrics[] = []
  for (let offset = 6; offset >= 0; offset--) {
    const date = addDays(now, -offset)
    const iso = toISODate(date)
    const daySessions = sessions.filter(session => session.date === iso)
    const dayCompleted = daySessions.filter(session => session.completed)
    last7Days.push({
      date: iso,
      minutes: dayCompleted.reduce((sum, session) => sum + session.durationMinutes, 0),
      sessions: daySessions.length,
      completedSessions: dayCompleted.length,
    })
  }

  return {
    totalSessions,
    completedSessions: completedSessions.length,
    abandonedSessions,
    completionRate,
    totalFocusMinutes,
    averageSessionMinutes,
    currentStreak: computeCurrentStreak(completedDates, now),
    longestStreak: computeLongestStreak(completedDates),
    last7Days,
  }
}
