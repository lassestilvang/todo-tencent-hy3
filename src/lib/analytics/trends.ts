/**
 * Analytics & Trends Service
 * Provides productivity insights, predictions, and trend analysis
 */

import { Task, TaskLog } from '@/types'

/**
 * Task completion statistics
 */
export interface TaskCompletionStats {
  totalTasks: number
  completedTasks: number
  completionRate: number
  averageTime: number
  totalTime: number
  estimatedTime: number
  overdueCount: number
  streak: number
  longestStreak: number
}

/**
 * Daily statistics for charting
 */
export interface DailyStats {
  date: string
  created: number
  completed: number
  totalTime: number
  estimatedTime: number
  overdue: number
  priorityBreakdown: {
    high: number
    medium: number
    low: number
  }
}

/**
 * Time range for analytics
 */
export type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * Trend analysis result
 */
export interface TrendResult {
  metric: string
  trend: 'up' | 'down' | 'steady'
  percentageChange: number
  confidence: number
}

/**
 * Predictive analysis
 */
export interface Prediction {
  metric: string
  predictedValue: number
  confidence: number
  reasoning: string[]
}

/**
 * Get task completion statistics
 */
export async function getCompletionStats(
  tasks: Task[],
  _logs: TaskLog[]
): Promise<TaskCompletionStats> {
  const completed = tasks.filter(t => t.completed)
  const now = new Date()

  // Calculate completion streak
  let streak = 0
  for (let i = 0; i < 30; i++) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const hasCompleted = completed.some(t => t.completed_at?.startsWith(dateStr))
    if (hasCompleted) streak++
    else break
  }

  // Calculate longest streak from logs
  let longestStreak = 0
  let currentStreak = 0
  const completionDates = completed
    .map(t => new Date(t.completed_at || t.created_at).toISOString().split('T')[0])
    .sort()

  for (let i = 0; i < completionDates.length; i++) {
    if (i === 0 || completionDates[i] !== completionDates[i-1]) {
      currentStreak = 1
    } else {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    }
  }

  const totalTime = completed.reduce((sum, t) => sum + (t.actual_time || 0), 0)
  const estimatedTime = completed.reduce((sum, t) => sum + (t.estimate || 0), 0)

  return {
    totalTasks: tasks.length,
    completedTasks: completed.length,
    completionRate: tasks.length > 0 ? completed.length / tasks.length : 0,
    averageTime: completed.length > 0 ? totalTime / completed.length : 0,
    totalTime,
    estimatedTime,
    overdueCount: tasks.filter(t => !t.completed && isOverdue(t)).length,
    streak,
    longestStreak: Math.max(streak, longestStreak),
  }
}

/**
 * Check if task is overdue
 */
function isOverdue(task: Task): boolean {
  if (task.completed) return false

  const today = new Date().toISOString().split('T')[0]
  const deadline = task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : null

  if (deadline && deadline < today) return true
  if (task.date && task.date < today) return true

  return false
}

/**
 * Get daily statistics for trend analysis
 */
export async function getDailyStats(
  tasks: Task[],
  days = 30
): Promise<DailyStats[]> {
  const stats: DailyStats[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const dayTasks = tasks.filter(t => {
      const taskDate = t.created_at?.split('T')[0] || t.date || ''
      return taskDate === dateStr
    })

    const completed = dayTasks.filter(t => t.completed)
    const totalTime = completed.reduce((sum, t) => sum + (t.actual_time || 0), 0)
    const estimatedTime = completed.reduce((sum, t) => sum + (t.estimate || 0), 0)
    const overdue = dayTasks.filter(t => isOverdue(t)).length

    const priorityBreakdown = {
      high: completed.filter(t => t.priority === 'high').length,
      medium: completed.filter(t => t.priority === 'medium').length,
      low: completed.filter(t => t.priority === 'low').length,
    }

    stats.push({
      date: dateStr,
      created: dayTasks.length,
      completed: completed.length,
      totalTime,
      estimatedTime,
      overdue,
      priorityBreakdown,
    })
  }

  return stats
}

/**
 * Analyze trends and get direction
 */
export function analyzeTrend(values: number[]): TrendResult {
  if (values.length < 2) {
    return {
      metric: 'unknown',
      trend: 'steady',
      percentageChange: 0,
      confidence: 0,
    }
  }

  // Use linear regression slope to detect trend direction.
  // This works reliably for any series length (>= 2).
  const n = values.length
  const xs = values.map((_, i) => i)
  const meanX = (n - 1) / 2
  const meanY = values.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    num += dx * (values[i] - meanY)
    den += dx * dx
  }

  const slope = den > 0 ? num / den : 0

  // Convert slope into a percentage change relative to the mean.
  const percentageChange = meanY > 0 ? (slope / meanY) * 100 : 0

  let trend: 'up' | 'down' | 'steady' = 'steady'
  if (percentageChange > 5) trend = 'up'
  else if (percentageChange < -5) trend = 'down'

  const confidence = Math.min(1, Math.abs(percentageChange) / 20)

  return {
    metric: 'completion_rate',
    trend,
    percentageChange,
    confidence,
  }
}

/**
 * Generate predictions based on historical data
 */
export function predictFutureStats(stats: DailyStats[]): Prediction[] {
  const predictions: Prediction[] = []

  // Predict completion rate
  const completedValues = stats.map(s => s.completed)
  const trend = analyzeTrend(completedValues)

  if (stats.length > 0) {
    const lastDay = stats[stats.length - 1]
    const nextDayCompletion = Math.round(lastDay.completed * (1 + trend.percentageChange / 100))
    predictions.push({
      metric: 'next_day_completion',
      predictedValue: nextDayCompletion,
      confidence: trend.confidence,
      reasoning: [
        `Trend: ${trend.trend}`,
        `Average completed: ${Math.round(completedValues.reduce((a, b) => a + b, 0) / completedValues.length)}`,
      ],
    })
  }

  // Predict optimal focus time
  let optimalHour = 9
  let maxCompletion = 0

  // Analyze when tasks are most often completed
  for (const stat of stats) {
    const hour = parseFloat(stat.date.split('T')[0].substring(11, 13)) || 9
    if (stat.completed > maxCompletion) {
      maxCompletion = stat.completed
      optimalHour = hour
    }
  }

  predictions.push({
    metric: 'optimal_focus_hour',
    predictedValue: optimalHour,
    confidence: 0.7,
    reasoning: [
      `Peak completion hours: ${stats
        .filter(s => s.completed === maxCompletion)
        .map(s => s.date)
        .slice(0, 3)
        .join(', ')}`,
    ],
  })

  return predictions
}

/**
 * Calculate productivity score
 */
export function calculateProductivityScore(
  stats: TaskCompletionStats,
  dailyStats: DailyStats[]
): number {
  // Each factor is normalized to 0-100, then combined with weights that
  // sum to 1 so the result is a genuine 0-100 score (not a clamped sum).

  // 40% completion rate
  const completionScore = stats.completionRate * 100

  // 20% estimation accuracy: 100 when actual matches estimate exactly
  const timeEfficiencyScore = stats.totalTime > 0 && stats.estimatedTime > 0
    ? Math.max(0, 100 - Math.abs(stats.totalTime - stats.estimatedTime) / stats.estimatedTime * 100)
    : 50

  // 20% consistency: share of tracked days on which anything was completed
  const activeDays = dailyStats.filter(d => d.completed > 0).length
  const consistencyScore = dailyStats.length > 0
    ? (activeDays / dailyStats.length) * 100
    : 50

  // 20% momentum: current streak relative to the best streak achieved
  const momentumScore = stats.longestStreak > 0
    ? (stats.streak / stats.longestStreak) * 100
    : 50

  const rawScore =
    completionScore * 0.4 +
    timeEfficiencyScore * 0.2 +
    consistencyScore * 0.2 +
    momentumScore * 0.2

  // Overdue tasks are a penalty, applied after the weighted average
  const overduePenalty = Math.min(30, stats.overdueCount * 3)

  return Math.round(Math.max(0, Math.min(100, rawScore - overduePenalty)))
}

/**
 * Generate productivity insights
 */
export function generateInsights(
  tasks: Task[],
  stats: TaskCompletionStats,
  dailyStats: DailyStats[]
): string[] {
  const insights: string[] = []

  // Completion rate insight
  if (stats.completionRate > 0.8) {
    insights.push('Excellent task completion rate! Keep up the momentum.')
  } else if (stats.completionRate < 0.5) {
    insights.push('Consider breaking large tasks into smaller, more manageable pieces.')
  }

  // Overdue tasks
  if (stats.overdueCount > 0) {
    insights.push(`${stats.overdueCount} task(s) are overdue. Consider reviewing your deadlines.`)
  }

  // Streak
  if (stats.streak >= 7) {
    insights.push(`Great streak! You've completed ${stats.streak} days in a row.`)
  }

  // Time efficiency
  if (stats.totalTime > 0 && stats.estimatedTime > 0) {
    const overrun = (stats.totalTime - stats.estimatedTime) / stats.estimatedTime
    if (overrun > 0.3) {
      insights.push('Tasks are taking longer than estimated. Consider being more realistic with estimates.')
    }
  }

  // Priority distribution
  const highPriorityCompleted = dailyStats[0]?.priorityBreakdown.high || 0
  if (highPriorityCompleted > 3) {
    insights.push('You\'re effectively tackling high-priority tasks!')
  }

  return insights
}

/**
 * Export analytics data for backup
 */
export function exportAnalyticsData(
  stats: TaskCompletionStats,
  dailyStats: DailyStats[],
  patterns: {
    modelVersion: number
    lastUpdated: number
    trainingDataPoints: number
  }
): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    stats,
    dailyStats,
    patterns,
  }, null, 2)
}