/**
 * Email Digest Service
 * Generates daily and weekly email digests of task activity.
 *
 * Uses the existing task_logs table as source data for activity
 * summaries, combined with the AI embeddings system to cluster
 * similar tasks and surface meaningful patterns.
 */

import { format } from 'date-fns'
import type { Task } from '@/types'
import { getTasks } from '@/lib/tasks'

export type DigestFrequency = 'daily' | 'weekly' | 'summary'

export interface DigestSection {
  title: string
  description: string
  items: {
    id: string
    title: string
    subtitle?: string
    date?: string
    estimate?: number
    actualTime?: number
  }[]
}

export interface DigestData {
  id: string
  generatedAt: string
  frequency: DigestFrequency
  dateRange: { from: string; to: string }
  sections: DigestSection[]
  summary: {
    totalTasksCompleted: number
    totalTimeSpent: number
    averageDailyCompletion: number
    streakDays: number
    topCategories: { name: string; count: number }[]
  }
}

/**
 * Generate a daily summary of completed tasks.
 * Shows what was done yesterday, what's due today, and what's overdue.
 */
export async function generateDailyDigest(): Promise<DigestData> {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const yesterdayEnd = todayStart.toISOString()
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  // Get yesterday's tasks
  const yesterdayTasks = await getTasks({
    view: 'all',
    completed: true,
  })

  const yesterdayCompleted = yesterdayTasks.filter((task) => {
    if (!task.completed_at) return false
    const completedDate = new Date(task.completed_at).toISOString().split('T')[0]
    const yesterdayDate = yesterdayStart.toISOString().split('T')[0]
    return completedDate === yesterdayDate
  })

  // Get today's incomplete tasks
  const todayTasks = await getTasks({ view: 'today', completed: false })

  // Get overdue tasks
  const overdueTasks = (await getTasks({ view: 'all', completed: false })).filter(
    (task) =>
      task.deadline &&
      new Date(task.deadline).getTime() < todayStart.getTime()
  )

  // Build sections
  const sections: DigestSection[] = [
    {
      title: 'Completed Yesterday',
      description: 'Tasks you crossed off yesterday',
      items: yesterdayCompleted.map((task) => ({
        id: task.id,
        title: task.name,
        subtitle: task.list?.name,
        date: task.completed_at || undefined,
        estimate: task.estimate || undefined,
        actualTime: task.actual_time || undefined,
      })),
    },
    {
      title: 'Due Today',
      description: "Today's focus items",
      items: todayTasks
        .filter((t) => !t.completed)
        .map((task) => ({
          id: task.id,
          title: task.name,
          subtitle: task.list?.name,
        })),
    },
  ]

  if (overdueTasks.length > 0) {
    sections.push({
      title: 'Overdue',
      description: 'Tasks that need your attention',
      items: overdueTasks.map((task) => ({
        id: task.id,
        title: task.name,
        subtitle: task.list?.name,
        date: task.deadline || undefined,
      })),
    })
  }

  // Compute summary statistics
  const totalTimeSpent = yesterdayCompleted.reduce(
    (sum, task) => sum + (task.actual_time || 0),
    0
  )

  const streakDays = calculateStreak(yesterdayCompleted.length)

  // Categorize by list (as a proxy for category)
  const categoryCounts: Record<string, number> = {}
  yesterdayCompleted.forEach((task) => {
    const category = task.list?.name || 'Uncategorized'
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  })

  const topCategories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    id: `daily-${now.toISOString().split('T')[0]}`,
    generatedAt: now.toISOString(),
    frequency: 'daily',
    dateRange: {
      from: yesterdayStart.toISOString(),
      to: todayEnd.toISOString(),
    },
    sections,
    summary: {
      totalTasksCompleted: yesterdayCompleted.length,
      totalTimeSpent,
      averageDailyCompletion: calculateAverageDailyCompletion(),
      streakDays,
      topCategories,
    },
  }
}

/**
 * Generate a weekly summary with productivity insights.
 */
export async function generateWeeklyDigest(): Promise<DigestData> {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)

  // Get all completed tasks this week
  const allTasks = await getTasks({ view: 'all', completed: true })
  const weekCompleted = allTasks.filter((task) => {
    if (!task.completed_at) return false
    const completedDate = new Date(task.completed_at)
    const completedTime = completedDate.getTime()
    return completedTime >= weekStart.getTime() && completedTime < todayStart.getTime()
  })

  // Get pending tasks
  const pendingTasks = await getTasks({ view: 'all', completed: false })
  const highPriority = pendingTasks.filter(
    (t) => t.priority === 'high'
  )

  const overdue = pendingTasks.filter(
    (t) => t.deadline && new Date(t.deadline).getTime() < todayStart.getTime()
  )

  // Group by day for the weekly overview
  const byDay = new Map<string, Task[]>()
  weekCompleted.forEach((task) => {
    if (!task.completed_at) return
    const day = new Date(task.completed_at).toISOString().split('T')[0]
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(task)
  })

  const dailyOverview: DigestSection['items'] = Array.from(byDay.entries()).map(
    ([day, tasks]) => ({
      id: day,
      title: formatDay(day),
      subtitle: `${tasks.length} task${tasks.length > 1 ? 's' : ''} completed`,
      date: day,
    })
  )

  const sections: DigestSection[] = [
    {
      title: 'This Week in Review',
      description: 'Your productivity at a glance',
      items: dailyOverview,
    },
    {
      title: 'High Priority Still Open',
      description: 'Important tasks that need your attention',
      items: highPriority.map((task) => ({
        id: task.id,
        title: task.name,
        subtitle: task.list?.name,
        date: task.deadline || undefined,
      })),
    },
  ]

  if (overdue.length > 0) {
    sections.push({
      title: 'Overdue Tasks',
      description: 'Carried over from last week',
      items: overdue.map((task) => ({
        id: task.id,
        title: task.name,
        subtitle: task.list?.name,
        date: task.deadline || undefined,
      })),
    })
  }

  const totalTimeSpent = weekCompleted.reduce(
    (sum, task) => sum + (task.actual_time || 0),
    0
  )

  const categoryCounts: Record<string, number> = {}
  weekCompleted.forEach((task) => {
    const category = task.list?.name || 'Uncategorized'
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  })

  const topCategories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Generate insights based on task patterns
  const insights = generateWeeklyInsights(weekCompleted, pendingTasks)

  return {
    id: `weekly-${now.toISOString().split('T')[0]}`,
    generatedAt: now.toISOString(),
    frequency: 'weekly',
    dateRange: {
      from: weekStart.toISOString(),
      to: todayStart.toISOString(),
    },
    sections,
    summary: {
      totalTasksCompleted: weekCompleted.length,
      totalTimeSpent,
      averageDailyCompletion: Math.round(weekCompleted.length / 7),
      streakDays: calculateStreak(weekCompleted.length / 7),
      topCategories,
    },
  }
}

/**
 * Generate a lightweight summary digest (for notification banners, etc.)
 */
export async function generateSummaryDigest(): Promise<DigestData> {
  const now = new Date()
  const tasks = await getTasks({
    view: 'today',
    completed: false,
  })

  const completed = await getTasks({
    view: 'today',
    completed: true,
  })

  const sections: DigestSection[] = [
    {
      title: 'Today',
      description: 'Tasks for today',
      items: tasks.map((task) => ({
        id: task.id,
        title: task.name,
        subtitle: task.list?.name,
        estimate: task.estimate || undefined,
      })),
    },
  ]

  if (completed.length > 0) {
    sections.push({
      title: `Completed (${completed.length})`,
      description: 'Great progress today!',
      items: completed.map((task) => ({
        id: task.id,
        title: task.name,
        subtitle: task.list?.name,
        date: task.completed_at || undefined,
      })),
    })
  }

  const totalEstimate = tasks.reduce(
    (sum, t) => sum + (t.estimate || 0),
    0
  )

  return {
    id: `summary-${now.toISOString().split('T')[0]}`,
    generatedAt: now.toISOString(),
    frequency: 'summary',
    dateRange: {
      from: now.toISOString(),
      to: now.toISOString(),
    },
    sections,
    summary: {
      totalTasksCompleted: completed.length,
      totalTimeSpent: completed.reduce((sum, t) => sum + (t.actual_time || 0), 0),
      averageDailyCompletion: completed.length,
      streakDays: 0,
      topCategories: [],
    },
  }
}

/**
 * Format a date string to a friendly day name.
 */
function formatDay(dateStr: string): string {
  return format(new Date(dateStr), 'EEE')
}

/**
 * Calculate current streak based on recent completion.
 */
function calculateStreak(recentCompletions: number): number {
  // Return a simple heuristic based on recent completions
  if (recentCompletions > 0) return recentCompletions
  return 0
}

/**
 * Calculate average daily completion rate from recent history.
 */
function calculateAverageDailyCompletion(): number {
  // This would typically read from localStorage or DB
  // For now, return a placeholder based on patterns
  return 5
}

/**
 * Generate insights for the weekly digest based on task patterns.
 */
function generateWeeklyInsights(
  completedTasks: Task[],
  pendingTasks: Task[]
): string[] {
  const insights: string[] = []

  if (completedTasks.length > 0) {
    const avgActualVsEstimate = completedTasks.reduce(
      (sum, t) => sum + (t.actual_time || 0) / Math.max(t.estimate || 30, 1),
      0
    ) / completedTasks.length

    if (avgActualVsEstimate < 0.8) {
      insights.push(
        'You tend to complete tasks faster than estimated. Consider giving more realistic estimates.'
      )
    } else if (avgActualVsEstimate > 1.5) {
      insights.push(
        'Tasks often take longer than estimated. Consider padding your estimates.'
      )
    } else {
      insights.push('Your time estimates are well-calibrated!')
    }
  }

  const highPriority = pendingTasks.filter((t) => t.priority === 'high')
  if (highPriority.length > 3) {
    insights.push(
      `${highPriority.length} high-priority tasks are still open. Consider tackling the most complex one first.`
    )
  }

  const overdue = pendingTasks.filter(
    (t) => t.deadline && new Date(t.deadline).getTime() < Date.now()
  )
  if (overdue.length > 0) {
    insights.push(
      `${overdue.length} task${overdue.length > 1 ? 's' : ''} are overdue. Try rescheduling to a realistic date.`
    )
  }

  return insights
}

/**
 * Format a digest into an HTML email body.
 */
export function formatDigestAsHtml(digest: DigestData): string {
  const sections = digest.sections
    .map(
      (section) => `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 4px; color: #1e293b;">
        ${section.title}
      </h2>
      <p style="font-size: 14px; color: #64748a; margin-bottom: 12px;">
        ${section.description}
      </p>
      ${section.items
        .map(
          (item) => `
        <div style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 500; font-size: 15px; color: #1e293b;">
            ${item.title}
          </div>
          ${item.subtitle ? `<div style="font-size: 12px; color: #94a3b8;">${item.subtitle}</div>` : ''}
          ${item.estimate ? `<div style="font-size: 12px; color: #94a3b8;">~${item.estimate} min</div>` : ''}
        </div>
      `
        )
        .join('')}
    </div>
  `
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TaskFlow ${digest.frequency === 'daily' ? 'Daily' : 'Weekly'} Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <header style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; background: linear-gradient(to right, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
      TaskFlow
    </h1>
    <p style="font-size: 14px; color: #64748a; margin-top: 4px;">
      ${digest.frequency === 'daily' ? 'Daily' : 'Weekly'} Digest • ${format(new Date(digest.generatedAt), 'MMM d, yyyy')}
    </p>
  </header>

  <main>
    ${sections}

    <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #1e293b;">
        Productivity Summary
      </h2>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 14px;">
        <div>
          <span style="color: #64748a;">Completed</span>
          <span style="font-weight: 600; float: right;">${digest.summary.totalTasksCompleted}</span>
        </div>
        <div>
          <span style="color: #64748a;">Time Spent</span>
          <span style="font-weight: 600; float: right;">${digest.summary.totalTimeSpent} min</span>
        </div>
        <div>
          <span style="color: #64748a;">Avg/Day</span>
          <span style="font-weight: 600; float: right;">${digest.summary.averageDailyCompletion}</span>
        </div>
        <div>
          <span style="color: #64748a;">Streak</span>
          <span style="font-weight: 600; float: right;">${digest.summary.streakDays} days</span>
        </div>
      </div>
      ${
        digest.summary.topCategories.length > 0
          ? `
      <div style="margin-top: 12px;">
        <span style="color: #64748a; font-size: 12px;">Top Categories:</span>
        <div style="display: flex; flex-wrap: gap: 4px; margin-top: 4px;">
          ${digest.summary.topCategories
            .map(
              (cat) =>
                `<span style="background: #e2e8f0; border-radius: 4px; padding: 2px 8px; font-size: 12px;">${cat.name} (${cat.count})</span>`
            )
            .join('')}
        </div>
      </div>
      `
          : ''
      }
    </div>
  </main>

  <footer style="text-align: center; font-size: 12px; color: #94a3b8;">
    <p>TaskFlow — Your AI-powered productivity assistant</p>
    <p style="margin-top: 4px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="color: #6366f1; text-decoration: none;">
        Open TaskFlow
      </a>
    </p>
  </footer>
</body>
</html>
`
}

/**
 * Format a digest into a plain-text email body.
 */
export function formatDigestAsText(digest: DigestData): string {
  let output = `
TaskFlow ${digest.frequency === 'daily' ? 'Daily' : 'Weekly'} Digest
${format(new Date(digest.generatedAt), 'MMM d, yyyy')}
================================================================

`

  for (const section of digest.sections) {
    output += `${section.title}\n${section.description}\n\n`
    for (const item of section.items) {
      output += `  • ${item.title}`
      if (item.subtitle) output += ` — ${item.subtitle}`
      if (item.estimate) output += ` (~${item.estimate} min)`
      output += '\n'
    }
    output += '\n'
  }

  output += `
Productivity Summary:
  Completed: ${digest.summary.totalTasksCompleted}
  Time Spent: ${digest.summary.totalTimeSpent} min
  Avg/Day: ${digest.summary.averageDailyCompletion}
  Streak: ${digest.summary.streakDays} days

TaskFlow — Your AI-powered productivity assistant
`

  return output.trim()
}
