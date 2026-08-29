import type { Task, List } from '@/types'

export interface Suggestion {
  id: string
  type: 'schedule' | 'reschedule' | 'priority' | 'list' | 'breakdown' | 'habit'
  title: string
  description: string
  action: {
    label: string
    type: 'create_task' | 'update_task' | 'navigate' | 'dismiss'
    payload?: Record<string, unknown>
  }
  priority: 'high' | 'medium' | 'low'
  dismissible: boolean
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

  // 1. Recurring task scheduling suggestions
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
        })
      }
    }
  })

  // 2. Reschedule overdue tasks to weekend
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
      })
    }
  }

  // 3. Priority suggestions - tasks without priority that are due soon
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
    })
  }

  // 4. List organization - tasks in wrong list based on pattern
  const misplacedTasks = incompleteTasks.filter((t) => {
    if (!t.list_id || !t.name) return false
    const pattern = patterns.find(
      (p) => p.name.toLowerCase() === t.name.toLowerCase().trim()
    )
    if (!pattern || pattern.commonLists.length === 0) return false
    const mostCommonList = getMostCommon(pattern.commonLists)
    return mostCommonList !== null && mostCommonList !== t.list_id
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
    })
  }

  // 5. Break down large tasks
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
    })
  }

  // 6. Habit formation - consistent daily tasks
  const dailyPatterns = patterns.filter((p) => p.frequency >= 5)
  if (dailyPatterns.length > 0) {
    const habitNames = dailyPatterns.map((p) => p.name).join(', ')
    suggestions.push({
      id: 'habit-formation',
      type: 'habit',
      title: 'Build a habit streak',
      description: `You do "${habitNames}" frequently. Set a daily recurring task?`,
      action: {
        label: 'Create Recurring',
        type: 'create_task',
        payload: {
          name: dailyPatterns[0].name,
          recurring: 'daily',
          recurring_days: [0, 1, 2, 3, 4, 5, 6],
        },
      },
      priority: 'medium',
      dismissible: true,
    })
  }

  // Sort by priority
  const priorityOrder = { high: 3, medium: 2, low: 1 }
  return suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
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

export function dismissSuggestion(suggestionId: string): void {
  if (typeof window !== 'undefined') {
    const dismissed = JSON.parse(localStorage.getItem('dismissed_suggestions') || '[]')
    if (!dismissed.includes(suggestionId)) {
      dismissed.push(suggestionId)
      localStorage.setItem('dismissed_suggestions', JSON.stringify(dismissed))
    }
  }
}

export function isSuggestionDismissed(suggestionId: string): boolean {
  if (typeof window === 'undefined') return false
  const dismissed = JSON.parse(localStorage.getItem('dismissed_suggestions') || '[]')
  return dismissed.includes(suggestionId)
}

export function clearDismissedSuggestions(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('dismissed_suggestions')
  }
}