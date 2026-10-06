/**
 * Completion Milestones
 *
 * Celebrates cumulative task-completion milestones (10, 50, 100, 1000)
 * using localStorage to track the running total and which milestones
 * have already been celebrated, so each threshold is celebrated exactly
 * once.
 */

/** Milestone thresholds, in ascending order. */
export const COMPLETION_MILESTONES = [10, 50, 100, 1000] as const

export type Milestone = (typeof COMPLETION_MILESTONES)[number]

export interface MilestoneAchievement {
  milestone: Milestone
  count: number
  /** Zero-based index into COMPLETION_MILESTONES */
  index: number
  /** How many more completions remain until the next milestone */
  remaining: number
  /** Completion count needed for the next milestone (null at 1000) */
  nextMilestone: Milestone | null
}

const CELEBRATED_KEY = 'taskflow_celebrated_milestones'
const TOTAL_COMPLETED_KEY = 'taskflow_total_completed'

/** Read the set of milestone numbers already celebrated from localStorage. */
export function getCompletedCelebrated(): Set<number> {
  try {
    const raw = JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]')
    if (!Array.isArray(raw)) return new Set()
    return new Set(raw.filter((n): n is number => typeof n === 'number'))
  } catch {
    return new Set()
  }
}

/** Record a milestone as celebrated in localStorage. */
export function markCelebrated(milestone: Milestone): void {
  try {
    const celebrated = getCompletedCelebrated()
    celebrated.add(milestone)
    localStorage.setItem(
      CELEBRATED_KEY,
      JSON.stringify(Array.from(celebrated)),
    )
  } catch {
    /* localStorage may be unavailable — fail silently */
  }
}

/** Get the cumulative total completed task count from localStorage. */
export function getTotalCompleted(): number {
  try {
    const raw = localStorage.getItem(TOTAL_COMPLETED_KEY)
    return raw ? parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

/** Set the cumulative total completed task count in localStorage. */
export function setTotalCompleted(count: number): void {
  try {
    localStorage.setItem(TOTAL_COMPLETED_KEY, String(count))
  } catch {
    /* fail silently */
  }
}

/**
 * Count the total completed tasks from the task list.
 * Used for progress display on the current page.
 */
export function countCompletedTasks(tasks: { completed: boolean }[]): number {
  return tasks.filter((t) => t.completed).length
}

/**
 * Check if completing a task at the given cumulative count crosses
 * a new milestone threshold. Returns the achievement if a new milestone
 * was just reached, or null otherwise.
 *
 * The comparison is strictly "≥ milestone" and checks against the
 * already-celebrated set so each milestone fires exactly once.
 */
export function checkMilestone(
  completedCount: number,
): MilestoneAchievement | null {
  const celebrated = getCompletedCelebrated()

  for (let i = 0; i < COMPLETION_MILESTONES.length; i++) {
    const milestone = COMPLETION_MILESTONES[i]
    if (completedCount >= milestone && !celebrated.has(milestone)) {
      const nextMilestone = COMPLETION_MILESTONES[i + 1] ?? null

      return {
        milestone,
        count: completedCount,
        index: i,
        remaining: nextMilestone
          ? Math.max(nextMilestone - completedCount, 0)
          : 0,
        nextMilestone,
      }
    }
  }

  return null
}

/**
 * Progress toward the next uncelebrated milestone.
 * Returns `{ current, next, progress }` where progress is 0–1.
 */
export function getMilestoneProgress(completedCount: number): {
  current: Milestone | 0
  next: Milestone | null
  progress: number
} {
  const celebrated = getCompletedCelebrated()
  const allCelebrated = COMPLETION_MILESTONES.every((m) =>
    celebrated.has(m)
  )

  if (allCelebrated) {
    return {
      current: 1000,
      next: null,
      progress: 1,
    }
  }

  // Find the highest milestone already celebrated
  const celebratedM = COMPLETION_MILESTONES.filter((m) =>
    celebrated.has(m)
  )
  const current = celebratedM.length > 0
    ? celebratedM[celebratedM.length - 1]
    : 0

  // Find the next uncelebrated milestone
  const nextMilestone = COMPLETION_MILESTONES.find((m) => !celebrated.has(m)) ?? null

  if (nextMilestone && current) {
    const progress = Math.min(
      (completedCount - current) / (nextMilestone - current),
      1,
    )
    return { current, next: nextMilestone, progress }
  }

  if (nextMilestone) {
    const progress = completedCount / nextMilestone
    return { current: 0, next: nextMilestone, progress }
  }

  return { current: 0, next: null, progress: 0 }
}

/** Milestone emoji and label for each threshold. */
export const MILESTONE_LABELS: Record<
  Milestone,
  { emoji: string; title: string; message: string }
> = {
  10: {
    emoji: '🥱',
    title: 'First Milestone!',
    message: '10 tasks completed — you\'re getting into a rhythm!',
  },
  50: {
    emoji: '🚀',
    title: 'Getting Momentum!',
    message: '50 tasks done — you\'re building real momentum!',
  },
  100: {
    emoji: '🎯',
    title: 'Hundred Club!',
    message: '100 tasks completed! You\'re officially a productivity machine.',
  },
  1000: {
    emoji: '🏆',
    title: 'Completionist!',
    message: '1,000 tasks done — the productivity legend has arrived.',
  },
}
