/**
 * Habit Loop Builder
 *
 * Models the classic habit loop (Cue → Craving → Response → Reward)
 * and tracks execution streaks. Habits can be linked to tasks so that
 * completing a habit can automatically complete or create a task.
 *
 * The core insight: habits are recurring tasks with an attached
 * psychological loop, and tracking the loop increases adherence.
 */

export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'custom'

export type HabitCue =
  | 'time'
  | 'location'
  | 'emotion'
  | 'preceding-action'
  | 'other-person'
  | 'environmental'

export type HabitReward =
  | 'tangible'
  | 'social'
  | 'achievement'
  | 'status'
  | 'knowledge'
  | 'peace-of-mind'

export interface HabitCueConfig {
  type: HabitCue
  // time: "09:00" (HH:MM)
  // location: "Kitchen" or "Office"
  // emotion: "stressed" | "energized" | "bored" | "excited"
  // preceding-action: task ID or description
  // other-person: person's name
  // environmental: "desk" | "phone" | "commute"
  value: string
}

export interface HabitRewardConfig {
  type: HabitReward
  // For 'tangible': what reward (e.g. "coffee", "10 min break")
  // For 'social': who (e.g. "@alex")
  // For 'achievement': what badge/achievement
  value: string
}

export interface Habit {
  id: string
  name: string
  description: string | null
  cue: HabitCueConfig
  craving: string // what the user wants to feel
  response: string // the action to take
  reward: HabitRewardConfig
  frequency: HabitFrequency
  // day-of-week for weekly (0-6), day-of-month for monthly
  schedule?: number[]
  taskIds?: string[] // tasks linked to this habit
  createdAt: string
  updatedAt: string
  active: boolean
}

export interface HabitExecution {
  id: string
  habitId: string
  completedAt: string
  // duration in minutes
  duration?: number
  // optional notes on how the loop felt
  satisfaction: number // 1-5
}

export interface HabitWithStats extends Habit {
  currentStreak: number
  longestStreak: number
  completions: number
  // percentage of scheduled days completed
  consistencyRate: number
  nextScheduled: Date | null
  // whether the user has skipped today
  skippedToday: boolean
}

/**
 * Determine if a habit should fire today based on frequency and schedule.
 */
export function isHabitScheduled(habit: Habit, date: Date = new Date()): boolean {
  if (!habit.active) return false

  const today = date.getDay()
  const dayOfMonth = date.getDate()

  switch (habit.frequency) {
    case 'daily':
      return true
    case 'weekly':
      return habit.schedule ? habit.schedule.includes(today) : true
    case 'monthly':
      return habit.schedule ? habit.schedule.includes(dayOfMonth) : true
    case 'custom':
      // Custom frequency uses schedule as day-of-week array
      return habit.schedule ? habit.schedule.includes(today) : true
    default:
      return true
  }
}

/**
 * Calculate habit statistics from execution history.
 */
export function calculateHabitStats(
  habit: Habit,
  executions: HabitExecution[],
  date: Date = new Date()
): HabitWithStats & { nextScheduled: Date | null } {
  // Sort executions by date
  const sorted = [...executions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  )

  // Build a set of completion dates (YYYY-MM-DD)
  const completionDates = new Set(
    sorted.map((e) => new Date(e.completedAt).toISOString().split('T')[0])
  )

  // Calculate current streak
  let currentStreak = 0
  let checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)

  while (true) {
    if (!isHabitScheduled(habit, checkDate)) {
      checkDate.setDate(checkDate.getDate() - 1)
      continue
    }

    const dateStr = checkDate.toISOString().split('T')[0]
    if (completionDates.has(dateStr)) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      // If there are future scheduled days that aren't completed, streak breaks
      // But if it's today and not yet completed, don't count it as a break
      const isToday =
        checkDate.toISOString().split('T')[0] ===
        new Date().toISOString().split('T')[0]
      if (!isToday) {
        break
      }
      checkDate.setDate(checkDate.getDate() - 1)
    }

    if (currentStreak > 365) break // safety limit
  }

  // Calculate longest streak
  let longestStreak = 0
  let tempStreak = 0
  checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (isHabitScheduled(habit, checkDate) && completionDates.has(dateStr)) {
      tempStreak++
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Total completions
  const completions = sorted.length

  // Consistency rate over the past 30 days
  let scheduledDays = 0
  let completedDays = 0
  checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)

  for (let i = 0; i < 30; i++) {
    if (isHabitScheduled(habit, checkDate)) {
      scheduledDays++
      const dateStr = checkDate.toISOString().split('T')[0]
      if (completionDates.has(dateStr)) {
        completedDays++
      }
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  const consistencyRate = scheduledDays > 0 ? completedDays / scheduledDays : 0

  // Next scheduled date
  let nextScheduled: Date | null = null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 60; i++) {
    const check = new Date(today)
    check.setDate(today.getDate() + i)
    if (isHabitScheduled(habit, check) && !completionDates.has(check.toISOString().split('T')[0])) {
      nextScheduled = check
      break
    }
  }

  const skippedToday =
    isHabitScheduled(habit, date) &&
    !completionDates.has(date.toISOString().split('T')[0])

  return {
    ...habit,
    currentStreak,
    longestStreak,
    completions,
    consistencyRate,
    nextScheduled,
    skippedToday,
  }
}

/**
 * Generate a human-readable description of the habit loop.
 */
export function describeHabitLoop(habit: Habit): string {
  const parts: string[] = []

  // Cue
  const cueDesc = describeCue(habit.cue)
  parts.push(`When ${cueDesc}`)

  // Craving
  parts.push(`I feel the urge to ${habit.craving.toLowerCase()}`)

  // Response
  parts.push(`so I ${habit.response.toLowerCase()}`)

  // Reward
  const rewardDesc = describeReward(habit.reward)
  parts.push(`which gives me ${rewardDesc}`)

  return parts.join('. ') + '.'
}

function describeCue(cue: HabitCueConfig): string {
  switch (cue.type) {
    case 'time':
      return `it's ${cue.value}`
    case 'location':
      return `I'm at ${cue.value}`
    case 'emotion':
      return `I feel ${cue.value}`
    case 'preceding-action':
      return `after ${cue.value}`
    case 'other-person':
      return `I'm with ${cue.value}`
    case 'environmental':
      return `I see ${cue.value}`
    default:
      return cue.value
  }
}

function describeReward(reward: HabitRewardConfig): string {
  switch (reward.type) {
    case 'tangible':
      return `a ${reward.value}`
    case 'social':
      return `connection with ${reward.value}`
    case 'achievement':
      return `the satisfaction of ${reward.value}`
    case 'status':
      return `recognition for ${reward.value}`
    case 'knowledge':
      return `learning about ${reward.value}`
    case 'peace-of-mind':
      return `peace of mind from ${reward.value}`
    default:
      return reward.value
  }
}

/**
 * Get a suggested habit template based on common patterns.
 */
export function getHabitTemplates(): Pick<Habit, 'name' | 'description' | 'cue' | 'craving' | 'response' | 'reward' | 'frequency'>[] {
  return [
    {
      name: 'Morning Pages',
      description: 'Write stream-of-consciousness thoughts to clear your mind each morning.',
      cue: { type: 'time', value: '08:00' },
      craving: 'mental clarity',
      response: 'write 3 pages of stream-of-consciousness thoughts',
      reward: { type: 'peace-of-mind', value: 'a clear, calm mind' },
      frequency: 'daily',
    },
    {
      name: 'Movement Break',
      description: 'Take a 5-minute movement break to reset energy and focus.',
      cue: { type: 'other-person', value: 'finishing a meeting' },
      craving: 'physical energy',
      response: 'do 5 minutes of stretching or walking',
      reward: { type: 'tangible', value: 'refreshed body' },
      frequency: 'daily',
    },
    {
      name: 'Weekly Review',
      description: 'Review your week, reflect on wins, and plan ahead.',
      cue: { type: 'time', value: 'Friday 16:00' },
      craving: 'sense of accomplishment',
      response: 'review completed tasks, celebrate wins, and plan next week',
      reward: { type: 'achievement', value: 'clarity on next steps' },
      frequency: 'weekly',
    },
    {
      name: 'Focus Ritual',
      description: 'A consistent pre-focus routine to enter deep work state.',
      cue: { type: 'environmental', value: 'desk setup complete' },
      craving: 'deep focus',
      response: 'put phone on Do Not Disturb, open focus playlist, and start timer',
      reward: { type: 'knowledge', value: 'productive work session' },
      frequency: 'daily',
    },
  ]
}
