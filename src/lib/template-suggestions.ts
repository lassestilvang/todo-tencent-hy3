/**
 * Template suggestions from history
 *
 * Finds tasks the user has created over and over and
 * proposes them as templates. Pure — the caller supplies
 * the tasks and the templates that already exist.
 */

import type { Task, Priority } from '@/types'

export interface TemplateSuggestion {
  name: string
  /** How many times a task with this name was created */
  occurrences: number
  listId: string | null
  priority: Priority
  /** Average estimate across the occurrences, null when never estimated */
  estimate: number | null
  /** ISO timestamp of the first and latest occurrence */
  firstSeen: string
  lastSeen: string
}

/** Creations needed before a task is worth templating. */
export const TEMPLATE_MIN_OCCURRENCES = 3

interface TaskAccumulator {
  name: string
  occurrences: number
  listIds: (string | null)[]
  priorities: Priority[]
  estimates: number[]
  firstSeen: string
  lastSeen: string
}

function getMostCommon<T>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1)
  })
  let best: T | null = null
  let bestCount = 0
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  })
  return best
}

/**
 * Suggest templates for frequently created one-off tasks.
 * Recurring tasks are skipped — they repeat on their own —
 * and names that already have a template are not repeated.
 */
export function suggestTemplates(
  tasks: Task[],
  existingTemplates: { name: string }[] = []
): TemplateSuggestion[] {
  const templatedNames = new Set(
    existingTemplates
      .map((template) => template.name?.toLowerCase().trim())
      .filter((name): name is string => Boolean(name))
  )

  const patterns = new Map<string, TaskAccumulator>()

  tasks.forEach((task) => {
    if (!task.name) return
    // Recurring tasks generate their own next occurrence,
    // so they never need a template.
    if (task.recurring) return

    const key = task.name.toLowerCase().trim()
    if (templatedNames.has(key)) return

    const createdAt = task.created_at || new Date().toISOString()
    const existing = patterns.get(key)

    if (existing) {
      existing.occurrences++
      existing.listIds.push(task.list_id)
      existing.priorities.push(task.priority)
      if (task.estimate) existing.estimates.push(task.estimate)
      if (createdAt < existing.firstSeen) existing.firstSeen = createdAt
      if (createdAt > existing.lastSeen) existing.lastSeen = createdAt
    } else {
      patterns.set(key, {
        name: task.name,
        occurrences: 1,
        listIds: [task.list_id],
        priorities: [task.priority],
        estimates: task.estimate ? [task.estimate] : [],
        firstSeen: createdAt,
        lastSeen: createdAt,
      })
    }
  })

  return Array.from(patterns.values())
    .filter((pattern) => pattern.occurrences >= TEMPLATE_MIN_OCCURRENCES)
    .map((pattern) => ({
      name: pattern.name,
      occurrences: pattern.occurrences,
      listId: getMostCommon(pattern.listIds),
      priority: getMostCommon(pattern.priorities) ?? 'none',
      estimate:
        pattern.estimates.length > 0
          ? Math.round(
              pattern.estimates.reduce((sum, e) => sum + e, 0) /
                pattern.estimates.length
            )
          : null,
      firstSeen: pattern.firstSeen,
      lastSeen: pattern.lastSeen,
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
}
