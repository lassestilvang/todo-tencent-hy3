/**
 * Deadline Escape Hatch
 *
 * When a task's deadline has been pushed 3+ times (detected via task-log
 * history), the system notices and suggests an intervention: decompose,
 * convert to template, or renegotiate. This prevents deadline thrashing.
 */

import type { Task, TaskLog } from '@/types'

/** Minimum deadline pushes before the escape hatch triggers. */
const DEADLINE_PUSH_THRESHOLD = 3

export type EscapeHatchAction = 'decompose' | 'template' | 'renegotiate' | 'accept'

export interface DeadlineEscapeHatch {
  /** How many times the deadline has been changed. */
  pushCount: number
  /** The original deadline (first one seen in logs), if recoverable. */
  originalDeadline?: string | null
  /** The current deadline. */
  currentDeadline: string | null
  /** Suggested intervention. */
  suggestion: EscapeHatchAction
  /** Human-readable explanation. */
  reason: string
  /** Whether the threshold has been reached. */
  triggered: boolean
}

/**
 * Detect deadline pushes from task logs.
 * Filters for log entries where the action is 'updated' and the
 * details mention 'deadline'.
 */
function detectDeadlinePushes(logs: TaskLog[]): TaskLog[] {
  return logs.filter(
    (log) =>
      log.action === 'updated' &&
      log.details?.toLowerCase().includes('deadline'),
  )
}

/**
 * Analyze a task's deadline history and decide if an escape-hatch
 * intervention is warranted.
 *
 * @param task The task to analyze (must have .logs and .sub_tasks)
 * @param logs Optional pre-fetched logs (falls back to task.logs)
 */
export function checkDeadlineEscapeHatch(
  task: Task,
  logs?: TaskLog[],
): DeadlineEscapeHatch {
  const taskLogs = logs ?? task.logs ?? []
  const deadlineChanges = detectDeadlinePushes(taskLogs)

  const pushCount = deadlineChanges.length
  const triggered = pushCount >= DEADLINE_PUSH_THRESHOLD
  const currentDeadline = task.deadline ?? null
  const originalDeadline = triggered
    ? task.deadline ?? null
    : task.deadline ?? null

  let suggestion: EscapeHatchAction = 'accept'
  let reason = ''

  if (triggered) {
    const completedSubtasks = task.sub_tasks?.filter((s) => s.completed).length ?? 0
    const totalSubtasks = task.sub_tasks?.length ?? 0

    if (totalSubtasks > 0 && completedSubtasks < totalSubtasks) {
      suggestion = 'decompose'
      reason = `Deadline pushed ${pushCount} times (${totalSubtasks} subtasks, ${completedSubtasks} complete). Break remaining work into smaller pieces.`
    } else if (pushCount >= 5) {
      suggestion = 'template'
      reason = `Deadline pushed ${pushCount} times. This looks like recurring work — convert to a task template for next time.`
    } else {
      suggestion = 'renegotiate'
      reason = `Deadline pushed ${pushCount} times. Consider renegotiating with stakeholders or splitting the task.`
    }
  } else if (pushCount === 2) {
    reason = `Deadline pushed ${pushCount} times. One more push will trigger an escape-hatch suggestion.`
  } else {
    reason = `Deadline is stable (${pushCount} changes).`
  }

  return {
    pushCount,
    originalDeadline,
    currentDeadline,
    suggestion,
    reason,
    triggered,
  }
}

/**
 * Batch-check all tasks for deadline thrash.
 * Returns only tasks that have triggered the escape hatch.
 */
export function findDeadlineThrash(tasks: Task[]): { task: Task; hutch: DeadlineEscapeHatch }[] {
  const results: { task: Task; hutch: DeadlineEscapeHatch }[] = []
  for (const task of tasks) {
    const hutch = checkDeadlineEscapeHatch(task)
    if (hutch.triggered) {
      results.push({ task, hutch })
    }
  }
  return results
}
