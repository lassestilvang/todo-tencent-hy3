/**
 * Task Autopsy
 *
 * Generates a post-mortem analysis for stalled or repeatedly-modified
 * tasks. Looks at the task's log history and current state to produce
 * a set of findings (e.g., "Deadline pushed 4 times") and suggested
 * interventions (e.g., "Decompose", "Archive", "Mark complete").
 *
 * A task is considered "stalled" if any of:
 * - It has 3+ deadline pushes (reuses Deadline Escape Hatch logic)
 * - It was reopened 2+ times
 * - It has 5+ update log entries and is still incomplete
 * - It has been in progress (not completed) for 7+ days since creation
 */

import type { Task, TaskLog } from '@/types'
import type { TimelineEntry } from '@/lib/tasks'
import { checkDeadlineEscapeHatch } from '@/lib/deadline-escape-hatch'

/** How many days a task can be open without completion before it's "stalled". */
const STALLEN_THRESHOLD_DAYS = 7

/** Minimum update entries before a task is considered churn-heavy. */
const CHURN_THRESHOLD = 5

/** Minimum deadline pushes before triggering the escape-hatch finding. */
const DEADLINE_PUSH_THRESHOLD = 3

/** Minimum reopen count to flag a finding. */
const REOPEN_THRESHOLD = 2

export type AutopsyFindingType =
  | 'deadline_thrash'
  | 'reopened_repeatedly'
  | 'update_churn'
  | 'long_stall'
  | 'overestimated'
  | 'no_progress'

export interface AutopsyFinding {
  type: AutopsyFindingType
  severity: 'warning' | 'critical'
  title: string
  insight: string
}

export type AutopsyRecommendation =
  | 'decompose'
  | 'archive'
  | 'mark_complete'
  | 'renegotiate'
  | 'template'

export interface AutopsyRecommendationDetail {
  action: AutopsyRecommendation
  label: string
  description: string
}

export interface TaskAutopsy {
  stalled: boolean
  findings: AutopsyFinding[]
  recommendations: AutopsyRecommendationDetail[]
  /** Total number of update log entries */
  updateCount: number
  /** Number of deadline pushes detected */
  deadlinePushes: number
  /** Number of times the task was reopened */
  reopenCount: number
  /** Days since the task was created (if incomplete) */
  daysOpen: number
}

const RECOMMENDATION_DETAILS: Record<
  AutopsyRecommendation,
  AutopsyRecommendationDetail
> = {
  decompose: {
    action: 'decompose',
    label: 'Break Down',
    description: 'Split this task into smaller, independently completable subtasks',
  },
  archive: {
    action: 'archive',
    label: 'Archive',
    description: 'Move this task to an archive list — it may no longer be relevant',
  },
  mark_complete: {
    action: 'mark_complete',
    label: 'Mark Complete',
    description: 'If this work was done, mark it complete and move on',
  },
  renegotiate: {
    action: 'renegotiate',
    label: 'Renegotiate',
    description: 'Push the deadline or reduce scope with stakeholders',
  },
  template: {
    action: 'template',
    label: 'Save as Template',
    description: 'Convert this into a reusable task template for future use',
  },
}

/**
 * Generate a Task Autopsy report for a stalled task.
 *
 * @param task The task to analyze (must have .logs for log-based findings)
 * @param timeline Optional pre-computed timeline (avoids redundant work)
 */
export function generateTaskAutopsy(
  task: Task,
  timeline?: TimelineEntry[],
): TaskAutopsy {
  const logs: TaskLog[] = task.logs ?? []
  const findings: AutopsyFinding[] = []

  // Count deadline pushes
  const deadlinePushes = logs.filter(
    (log) =>
      log.action === 'updated' &&
      log.details?.toLowerCase().includes('deadline'),
  ).length

  // Count reopens
  const reopenCount = logs.filter(
    (log) => log.action === 'reopened',
  ).length

  // Count total update entries
  const updateCount = logs.filter((log) => log.action === 'updated').length

  // Days open (if incomplete)
  let daysOpen = 0
  if (!task.completed && task.created_at) {
    const createdDate = new Date(task.created_at)
    const now = new Date()
    daysOpen = Math.floor(
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
    )
  }

  // --- Generate findings ---

  // 1. Deadline thrash (≥3 pushes)
  if (deadlinePushes >= DEADLINE_PUSH_THRESHOLD) {
    const hutch = checkDeadlineEscapeHatch(task)
    findings.push({
      type: 'deadline_thrash',
      severity: deadlinePushes >= 5 ? 'critical' : 'warning',
      title: `Deadline pushed ${deadlinePushes} times`,
      insight: hutch.reason,
    })
  }

  // 2. Repeated reopening
  if (reopenCount >= REOPEN_THRESHOLD) {
    findings.push({
      type: 'reopened_repeatedly',
      severity: 'critical',
      title: `Reopened ${reopenCount} times`,
      insight: `This task has been marked complete and reopened ${reopenCount} times, suggesting unclear completion criteria or scope creep.`,
    })
  }

  // 3. Update churn (many edits, still incomplete)
  if (updateCount >= CHURN_THRESHOLD && !task.completed) {
    findings.push({
      type: 'update_churn',
      severity: 'warning',
      title: `${updateCount} edits, still incomplete`,
      insight: `This task has been edited ${updateCount} times without completion. Frequent changes may indicate poorly defined requirements.`,
    })
  }

  // 4. Long stall (open for many days, not completed)
  if (daysOpen >= STALLEN_THRESHOLD_DAYS && !task.completed) {
    findings.push({
      type: 'long_stall',
      severity: deadlinePushes >= DEADLINE_PUSH_THRESHOLD ? 'critical' : 'warning',
      title: `Open for ${daysOpen} days`,
      insight: `This task has been open for ${daysOpen} days without completion. It may be blocked, deprioritized, or obsolete.`,
    })
  }

  // 5. Overestimated (significant actual_time, still not done)
  if (
    task.actual_time &&
    task.estimate &&
    task.actual_time > task.estimate * 2 &&
    !task.completed
  ) {
    findings.push({
      type: 'overestimated',
      severity: 'warning',
      title: `Underestimated effort (spent ${task.actual_time}min, estimated ${task.estimate}min)`,
      insight: `Actual time spent is more than double the original estimate. The initial scope assessment was off.`,
    })
  }

  // 6. No meaningful progress (no updates in the last 3 days)
  const recentLogs = logs.filter((log) => {
    const logDate = new Date(log.created_at)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    return logDate > threeDaysAgo
  })
  if (recentLogs.length === 0 && !task.completed && daysOpen >= STALLEN_THRESHOLD_DAYS) {
    findings.push({
      type: 'no_progress',
      severity: 'warning',
      title: 'No recent activity',
      insight: 'This task has had no updates in 3+ days. Check if it is blocked or should be deferred.',
    })
  }

  // --- Generate recommendations ---
  const recommendations: AutopsyRecommendationDetail[] = []

  if (findings.length === 0) {
    // Task is healthy — no autopsy needed
    return {
      stalled: false,
      findings: [],
      recommendations: [],
      updateCount,
      deadlinePushes,
      reopenCount,
      daysOpen,
    }
  }

  // Build recommendations based on findings
  const hasCritical = findings.some((f) => f.severity === 'critical')
  const hasThrash = findings.some((f) => f.type === 'deadline_thrash')
  const hasChurn = findings.some((f) => f.type === 'update_churn')
  const hasRework = findings.some((f) => f.type === 'reopened_repeatedly')
  const hasSubtasks = task.sub_tasks && task.sub_tasks.length > 0

  if (hasThrash || hasChurn) {
    if (hasSubtasks) {
      recommendations.push(RECOMMENDATION_DETAILS.decompose)
    } else {
      recommendations.push(RECOMMENDATION_DETAILS.decompose)
    }
  }

  if (hasRework) {
    recommendations.push(RECOMMENDATION_DETAILS.mark_complete)
  }

  if (hasCritical) {
    recommendations.push(RECOMMENDATION_DETAILS.archive)
  }

  if (deadlinePushes >= 5) {
    recommendations.push(RECOMMENDATION_DETAILS.template)
  }

  if (recommendations.length === 0) {
    recommendations.push(RECOMMENDATION_DETAILS.renegotiate)
  }

  return {
    stalled: true,
    findings,
    recommendations: recommendations.filter(
      (r, i, arr) => arr.findIndex((x) => x.action === r.action) === i,
    ),
    updateCount,
    deadlinePushes,
    reopenCount,
    daysOpen,
  }
}

/**
 * Batch-analyze all tasks for stalling patterns.
 * Returns only tasks that have an autopsy with findings.
 */
export function findStalledTasks(
  tasks: Task[],
): { task: Task; autopsy: TaskAutopsy }[] {
  const results: { task: Task; autopsy: TaskAutopsy }[] = []
  for (const task of tasks) {
    const autopsy = generateTaskAutopsy(task)
    if (autopsy.stalled) {
      results.push({ task, autopsy })
    }
  }
  return results
}
