import type { Task, List } from '@/types'
import { suggestOptimalTime } from '@/lib/ai/task-prioritizer'
import type { UserContext } from '@/lib/ai/task-prioritizer'

export interface Suggestion {
  id: string
  type: 'schedule' | 'reschedule' | 'priority' | 'list' | 'breakdown' | 'habit' | 'batch' | 'delegate' | 'energy'
  title: string
  description: string
  action: {
    label: string
    type: 'create_task' | 'update_task' | 'navigate' | 'dismiss'
    payload?: Record<string, unknown>
  }
  priority: 'high' | 'medium' | 'low' | 'urgent'
  dismissible: boolean
  confidence?: number
  aiReason?: string
}

interface TaskPattern {
  name: string
  frequency: number
  commonDays: number[]
  commonHours: number[]
  commonLists: string[]
  commonPriorities: string[]
  averageDuration: number
}

function analyzeTaskPatterns(tasks: Task[]): TaskPattern[] {
  const patternMap = new Map<string, TaskPattern>()

  tasks.forEach((task) => {
    if (!task.name) return
    const normalizedName = task.name.toLowerCase().trim()
    const existing = patternMap.get(normalizedName)

    const createdDate = task.created_at ? new Date(task.created_at) : new Date()
    const dayOfWeek = createdDate.getDay()
    const hour = createdDate.getHours()

    if (existing) {
      existing.frequency++
      existing.commonDays.push(dayOfWeek)
      existing.commonHours.push(hour)
      if (task.list_id) existing.commonLists.push(task.list_id)
      if (task.priority) existing.commonPriorities.push(task.priority)
      if (task.estimate) {
        existing.averageDuration =
          (existing.averageDuration * (existing.frequency - 1) + task.estimate) /
          existing.frequency
      }
    } else {
      patternMap.set(normalizedName, {
        name: task.name,
        frequency: 1,
        commonDays: [dayOfWeek],
        commonHours: [hour],
        commonLists: task.list_id ? [task.list_id] : [],
        commonPriorities: task.priority ? [task.priority] : [],
        averageDuration: task.estimate || 30,
      })
    }
  })

  return Array.from(patternMap.values())
    .filter((p) => p.frequency >= 2)
    .sort((a, b) => b.frequency - a.frequency)
}

function getMostCommon<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  const counts = new Map<T, number>()
  arr.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1))
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[day]
}

function getTimeOfDay(hour: number): string {
  if (hour < 6) return 'early morning'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

export function generateSmartSuggestions(
  tasks: Task[],
  lists: List[],
  incompleteTasks: Task[]
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const patterns = analyzeTaskPatterns(tasks)

  // 1. Recurring task scheduling suggestions (enhanced with AI)
  patterns.forEach((pattern) => {
    const commonDay = getMostCommon(pattern.commonDays)
    const commonHour = getMostCommon(pattern.commonHours)
    const commonList = getMostCommon(pattern.commonLists)
    const commonPriority = getMostCommon(pattern.commonPriorities)

    if (commonDay !== null && commonHour !== null && pattern.frequency >= 3) {
      const dayName = getDayName(commonDay)
      const timeOfDay = getTimeOfDay(commonHour)

      // Check if there's already a task for this pattern this week
      const hasRecentTask = incompleteTasks.some((t) => {
        if (!t.name || !t.deadline) return false
        const taskName = t.name.toLowerCase().trim()
        if (taskName !== pattern.name.toLowerCase()) return false
        const dueDate = new Date(t.deadline)
        const now = new Date()
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays >= 0 && diffDays <= 7
      })

      if (!hasRecentTask) {
        const listName = lists.find((l) => l.id === commonList)?.name || 'Inbox'
        suggestions.push({
          id: `schedule-${pattern.name}`,
          type: 'schedule',
          title: `Schedule "${pattern.name}"`,
          description: `You usually do this on ${dayName}s in the ${timeOfDay}. Add it to ${listName}?`,
          action: {
            label: 'Add Task',
            type: 'create_task',
            payload: {
              name: pattern.name,
              suggested_day: commonDay,
              suggested_hour: commonHour,
              list_id: commonList,
              priority: commonPriority,
              estimated_duration: Math.round(pattern.averageDuration),
            },
          },
          priority: 'high',
          dismissible: true,
          confidence: 0.9,
          aiReason: `Detected ${pattern.frequency} similar tasks with pattern of ${dayName}s ${timeOfDay}`,
        })
      }
    }
  })

  // 2. Energy-based scheduling
  const energySuggestions = generateEnergySuggestions(tasks, incompleteTasks)
  suggestions.push(...energySuggestions)

  // 3. AI-powered batch suggestions
  const batchSuggestions = generateBatchSuggestions(incompleteTasks)
  suggestions.push(...batchSuggestions)

  // 4. Delegated tasks
  const delegationSuggestions = generateDelegationSuggestions(incompleteTasks)
  suggestions.push(...delegationSuggestions)

  // 5. Original suggestions (cont preserved)
  const originalSuggestions = generateOriginalSmartSuggestions(tasks, lists, incompleteTasks)
  suggestions.push(...originalSuggestions)

  // Feedback loop: drop suggestion types the user keeps
  // dismissing without accepting.
  const relevant = applyFeedbackLoop(suggestions)

  // Sort by priority
  const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
  return relevant.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
}

function generateEnergySuggestions(tasks: Task[], incompleteTasks: Task[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  const now = new Date()
  const currentHour = now.getHours()

  // Find tasks that would match energy patterns
  incompleteTasks.forEach(task => {
    const estimate = task.estimate || 30
    const context: UserContext = {
      energyLevel: currentHour >= 9 && currentHour <= 12 ? 'high' :
                  currentHour >= 14 && currentHour <= 16 ? 'medium' : 'low',
      availableTimeMinutes: 480
    }

    const optimalTime = suggestOptimalTime(task, context)

    if (optimalTime !== 'now' && estimate > 60) {
      suggestions.push({
        id: `energy-${task.id}`,
        type: 'energy',
        title: `Better time for "${task.name}"`,
        description: `AI suggests this ${estimate}min task for your optimal energy time: ${optimalTime}`,
        action: {
          label: 'View',
          type: 'navigate',
          payload: { taskId: task.id },
        },
        priority: 'medium',
        dismissible: true,
        confidence: 0.8,
        aiReason: 'Task duration vs. current energy level optimization',
      })
    }
  })

  return suggestions
}

function generateBatchSuggestions(tasks: Task[]): Suggestion[] {
  const suggestions: Suggestion[] = []

  // Find clusters of similar tasks
  const taskGroups = new Map<string, Task[]>()
  tasks.forEach(task => {
    const name = task.name.toLowerCase().split(' ')[0]
    if (!taskGroups.has(name)) {
      taskGroups.set(name, [])
    }
    taskGroups.get(name)!.push(task)
  })

  // Find groups with 3+ similar tasks
  taskGroups.forEach((group, key) => {
    if (group.length >= 3) {
      const totalTime = group.reduce((sum, t) => sum + (t.estimate || 30), 0)
      suggestions.push({
        id: `batch-${key}`,
        type: 'batch',
        title: `Batch ${group.length} similar tasks`,
        description: `Combine ${key} tasks into a single session to save switching time`,
        action: {
          label: 'Create Batch Session',
          type: 'create_task',
          payload: {
            name: `Batch: ${key}`,
            description: `Combined session for ${group.length} related tasks`,
            estimate: Math.round(totalTime * 0.9),
          },
        },
        priority: 'high',
        dismissible: true,
        confidence: 0.85,
        aiReason: 'Reduced switching cost analysis',
      })
    }
  })

  return suggestions
}

function generateDelegationSuggestions(tasks: Task[]): Suggestion[] {
  const suggestions: Suggestion[] = []

  // Look for tasks that someone else could do
  tasks.forEach(task => {
    if (task.priority === 'low' && task.estimate && task.estimate > 60) {
      suggestions.push({
        id: `delegate-${task.id}`,
        type: 'delegate',
        title: `Delegate "${task.name}"`,
        description: `This ${task.estimate}min task could be delegated to free up your time`,
        action: {
          label: 'Delegate',
          type: 'create_task',
          payload: {
            name: `Delegated: ${task.name}`,
            priority: 'low',
            list_id: 'delegated',
            description: 'Task delegated from main list',
          },
        },
        priority: 'medium',
        dismissible: true,
        confidence: 0.75,
        aiReason: 'Time allocation optimization',
      })
    }
  })

  return suggestions
}

function generateOriginalSmartSuggestions(
  tasks: Task[],
  lists: List[],
  incompleteTasks: Task[]
): Suggestion[] {
  const suggestions: Suggestion[] = []

  // Reschedule overdue tasks to weekend
  const overdueTasks = incompleteTasks.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date()
  )
  if (overdueTasks.length >= 3) {
    const lowPriorityOverdue = overdueTasks.filter(
      (t) => t.priority === 'low' || t.priority === 'medium'
    )
    if (lowPriorityOverdue.length >= 2) {
      suggestions.push({
        id: 'reschedule-weekend',
        type: 'reschedule',
        title: 'Move low-priority overdue tasks to weekend',
        description: `${lowPriorityOverdue.length} overdue tasks could be moved to Saturday/Sunday`,
        action: {
          label: 'Reschedule',
          type: 'update_task',
          payload: {
            task_ids: lowPriorityOverdue.map((t) => t.id),
            new_due_date: getNextWeekendDate().toISOString().split('T')[0],
          },
        },
        priority: 'medium',
        dismissible: true,
        confidence: 0.8,
        aiReason: 'Deadline optimization for low-priority tasks',
      })
    }
  }

  // Priority suggestions - tasks without priority that are due soon
  const noPrioritySoon = incompleteTasks.filter(
    (t) => !t.priority && t.deadline && new Date(t.deadline) < addDays(new Date(), 3)
  )
  if (noPrioritySoon.length >= 2) {
    suggestions.push({
      id: 'add-priority',
      type: 'priority',
      title: 'Set priorities for upcoming tasks',
      description: `${noPrioritySoon.length} tasks due in 3 days have no priority`,
      action: {
        label: 'Review',
        type: 'navigate',
        payload: { view: 'upcoming' },
      },
      priority: 'medium',
      dismissible: true,
      confidence: 0.8,
      aiReason: 'Deadline urgency analysis',
    })
  }

  // List organization - tasks in wrong list based on pattern
  const misplacedTasks = incompleteTasks.filter((t) => {
    if (!t.list_id || !t.name) return false
    const taskWords = t.name.toLowerCase().split(' ')
    const listName = lists.find(l => l.id === t.list_id)?.name.toLowerCase() || ''
    // Simple heuristic - task name doesn't match list name
    if (!taskWords.some(word => listName.includes(word))) return false
    return true
  })

  if (misplacedTasks.length >= 2) {
    suggestions.push({
      id: 'organize-lists',
      type: 'list',
      title: 'Move tasks to their usual lists',
      description: `${misplacedTasks.length} tasks might be in the wrong list based on your habits`,
      action: {
        label: 'Review',
        type: 'navigate',
        payload: { view: 'all' },
      },
      priority: 'low',
      dismissible: true,
      confidence: 0.7,
      aiReason: 'List categorization optimization',
    })
  }

  // Break down large tasks
  const largeTasks = incompleteTasks.filter(
    (t) => t.estimate && t.estimate > 120
  )
  if (largeTasks.length > 0) {
    suggestions.push({
      id: 'breakdown-large',
      type: 'breakdown',
      title: 'Break down large tasks',
      description: `${largeTasks.length} tasks estimated > 2 hours. Consider splitting them.`,
      action: {
        label: 'View Tasks',
        type: 'navigate',
        payload: { view: 'all', filter: 'large' },
      },
      priority: 'low',
      dismissible: true,
      confidence: 0.6,
      aiReason: 'Task complexity analysis',
    })
  }

  // Habit formation - consistent daily tasks
  const dailyPatterns = tasks.filter(t =>
    t.name.toLowerCase().includes('review') ||
    t.name.toLowerCase().includes('meeting') ||
    t.name.toLowerCase().includes('check')
  ).filter(t => !t.completed)

  if (dailyPatterns.length >= 3) {
    suggestions.push({
      id: 'habit-formation',
      type: 'habit',
      title: 'Build a habit streak',
      description: `You frequently do daily tasks. Set a daily recurring task?`,
      action: {
        label: 'Create Recurring',
        type: 'create_task',
        payload: {
          name: 'Daily Review',
          recurring: 'daily',
          recurring_days: [0, 1, 2, 3, 4, 5, 6],
        },
      },
      priority: 'medium',
      dismissible: true,
      confidence: 0.8,
      aiReason: 'Habit formation recommendation',
    })
  }

  return suggestions
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getNextWeekendDate(): Date {
  const now = new Date()
  const day = now.getDay()
  // Saturday = 6, Sunday = 0
  let daysUntilSaturday = 6 - day
  if (daysUntilSaturday <= 0) daysUntilSaturday += 7
  return addDays(now, daysUntilSaturday)
}

const DISMISSED_SUGGESTIONS_KEY = 'taskflow_dismissed_suggestions'
const ACCEPTED_SUGGESTIONS_KEY = 'taskflow_accepted_suggestions'

/** Cap on how many feedback entries each log keeps. */
const FEEDBACK_LOG_LIMIT = 100

/** Interactions needed before a suggestion type's acceptance rate is trusted. */
export const FEEDBACK_MIN_SAMPLES = 3

/** Acceptance rate below which a suggestion type stops being offered. */
export const FEEDBACK_MIN_ACCEPTANCE_RATE = 0.25

interface DismissedSuggestion {
  id: string
  type?: Suggestion['type']
  dismissedAt?: string
}

interface AcceptedSuggestion {
  id: string
  type: Suggestion['type']
  acceptedAt: string
}

function readDismissedSuggestions(): DismissedSuggestion[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_SUGGESTIONS_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    // Older entries are bare ids; newer ones carry the type.
    return raw
      .map((entry) => (typeof entry === 'string' ? { id: entry } : entry))
      .filter(
        (entry): entry is DismissedSuggestion =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.id === 'string'
      )
  } catch (error) {
    console.warn('Failed to read dismissed suggestions:', error)
    return []
  }
}

function readAcceptedSuggestions(): AcceptedSuggestion[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCEPTED_SUGGESTIONS_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (entry): entry is AcceptedSuggestion =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'string' &&
        typeof entry.type === 'string'
    )
  } catch (error) {
    console.warn('Failed to read accepted suggestions:', error)
    return []
  }
}

function dismissSuggestion(suggestionId: string, type?: Suggestion['type']): void {
  try {
    const dismissed = readDismissedSuggestions()
    if (!dismissed.some((entry) => entry.id === suggestionId)) {
      dismissed.push({
        id: suggestionId,
        type,
        dismissedAt: new Date().toISOString(),
      })
      localStorage.setItem(
        DISMISSED_SUGGESTIONS_KEY,
        JSON.stringify(dismissed.slice(-FEEDBACK_LOG_LIMIT))
      )
    }
  } catch (error) {
    console.warn('Failed to dismiss suggestion:', error)
  }
}

function isSuggestionDismissed(suggestionId: string): boolean {
  try {
    return readDismissedSuggestions().some((entry) => entry.id === suggestionId)
  } catch (error) {
    console.warn('Failed to check dismissed suggestion:', error)
    return false
  }
}

function clearDismissedSuggestions(): void {
  try {
    localStorage.removeItem(DISMISSED_SUGGESTIONS_KEY)
  } catch (error) {
    console.warn('Failed to clear dismissed suggestions:', error)
  }
}

/** Record that the user acted on a suggestion. */
function acceptSuggestion(suggestion: { id: string; type: Suggestion['type'] }): void {
  try {
    const accepted = readAcceptedSuggestions()
    if (!accepted.some((entry) => entry.id === suggestion.id)) {
      accepted.push({
        id: suggestion.id,
        type: suggestion.type,
        acceptedAt: new Date().toISOString(),
      })
      localStorage.setItem(
        ACCEPTED_SUGGESTIONS_KEY,
        JSON.stringify(accepted.slice(-FEEDBACK_LOG_LIMIT))
      )
    }
  } catch (error) {
    console.warn('Failed to accept suggestion:', error)
  }
}

function isSuggestionAccepted(suggestionId: string): boolean {
  try {
    return readAcceptedSuggestions().some((entry) => entry.id === suggestionId)
  } catch (error) {
    console.warn('Failed to check accepted suggestion:', error)
    return false
  }
}

function clearAcceptedSuggestions(): void {
  try {
    localStorage.removeItem(ACCEPTED_SUGGESTIONS_KEY)
  } catch (error) {
    console.warn('Failed to clear accepted suggestions:', error)
  }
}

export interface SuggestionTypeFeedback {
  type: Suggestion['type']
  accepted: number
  dismissed: number
  total: number
  /** accepted / total interactions with this type */
  acceptanceRate: number
}

export interface SuggestionFeedbackStats {
  totalAccepted: number
  totalDismissed: number
  /** accepted / total interactions across all types */
  acceptanceRate: number
  byType: Partial<Record<Suggestion['type'], SuggestionTypeFeedback>>
}

/** Aggregates how each suggestion type has been received. */
export function getSuggestionFeedbackStats(): SuggestionFeedbackStats {
  const accepted = readAcceptedSuggestions()
  const dismissed = readDismissedSuggestions()

  const byType = new Map<Suggestion['type'], SuggestionTypeFeedback>()
  const track = (
    type: Suggestion['type'] | undefined,
    outcome: 'accepted' | 'dismissed'
  ) => {
    if (!type) return
    const stats: SuggestionTypeFeedback = byType.get(type) ?? {
      type,
      accepted: 0,
      dismissed: 0,
      total: 0,
      acceptanceRate: 0,
    }
    stats[outcome]++
    stats.total++
    stats.acceptanceRate = stats.accepted / stats.total
    byType.set(type, stats)
  }

  accepted.forEach((entry) => track(entry.type, 'accepted'))
  dismissed.forEach((entry) => track(entry.type, 'dismissed'))

  const totalAccepted = accepted.length
  const totalDismissed = dismissed.length
  const total = totalAccepted + totalDismissed

  return {
    totalAccepted,
    totalDismissed,
    acceptanceRate: total > 0 ? totalAccepted / total : 0,
    byType: Object.fromEntries(byType),
  }
}

/**
 * Feedback loop: stop offering suggestion types the user
 * consistently dismisses without ever accepting. Types without
 * enough history, and types meeting the acceptance bar, stay.
 */
function applyFeedbackLoop(suggestions: Suggestion[]): Suggestion[] {
  const stats = getSuggestionFeedbackStats()

  return suggestions.filter((suggestion) => {
    const typeStats = stats.byType[suggestion.type]
    if (!typeStats || typeStats.total < FEEDBACK_MIN_SAMPLES) {
      return true
    }
    return typeStats.acceptanceRate >= FEEDBACK_MIN_ACCEPTANCE_RATE
  })
}

export {
  dismissSuggestion,
  isSuggestionDismissed,
  clearDismissedSuggestions,
  acceptSuggestion,
  isSuggestionAccepted,
  clearAcceptedSuggestions,
}