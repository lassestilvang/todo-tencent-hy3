/**
 * AI Task Prioritization System
 * Multi-factor scoring engine for intelligent task prioritization
 */

import { Task } from '@/types'

/**
 * User context for AI analysis
 * Provides information about the user's current situation
 */
export interface UserContext {
  energyLevel: 'high' | 'medium' | 'low'
  availableTimeMinutes?: number
  focusMode?: boolean
  workHoursStart?: number
  workHoursEnd?: number
  productivityHistory?: { date: string; taskCount: number }[]
}

/**
 * Factor weights for scoring
 * These can be adjusted based on user feedback
 */
interface PriorityFactors {
  deadlineUrgency: number
  effortRequired: number
  dependencies: number
  energyMatch: number
  projectPhase: number
  historicalPattern: number
  priorityTag: number
  /** New 8th factor: cognitive load budget */
  cognitiveLoad: number
}

/**
 * Task priority result
 * Contains the overall score and breakdown of factors
 */
export interface TaskPriority {
  score: number // 0-100
  factors: Record<keyof PriorityFactors, number> // Each factor is 0-100
  recommendations: string[]
}

/**
 * Scoring weights - how much each factor contributes to the overall score
 */
const DEFAULT_WEIGHTS: PriorityFactors = {
  deadlineUrgency: 30,
  effortRequired: 20,
  dependencies: 15,
  energyMatch: 15,
  projectPhase: 10,
  historicalPattern: 5,
  priorityTag: 5,
  cognitiveLoad: 5,
}

/**
 * Calculate priority for a single task
 * Analyzes multiple factors to determine task priority
 */
export async function calculateTaskPriority(
  task: Task,
  context: UserContext
): Promise<TaskPriority> {
  const factors: Record<keyof PriorityFactors, number> = {
    deadlineUrgency: calculateDeadlineUrgency(task),
    effortRequired: calculateEffortRequired(task, context),
    dependencies: calculateDependencyScore(task),
    energyMatch: calculateEnergyMatch(task, context),
    projectPhase: calculateProjectPhase(task),
    historicalPattern: await calculateHistoricalPattern(task, context),
    priorityTag: calculatePriorityTag(task),
    cognitiveLoad: calculateCognitiveLoad(task),
  }

  // Calculate weighted score
  let totalScore = 0
  let totalWeight = 0
  for (const [key, weight] of Object.entries(DEFAULT_WEIGHTS)) {
    totalScore += (factors[key as keyof PriorityFactors] / 100) * weight
    totalWeight += weight
  }

  const score = Math.round((totalScore / totalWeight) * 100)

  // Generate recommendations
  const recommendations = generateRecommendations(factors, task, context)

  return {
    score,
    factors,
    recommendations,
  }
}

/**
 * Calculate deadline urgency (0-100)
 * Higher score = more urgent
 */
function calculateDeadlineUrgency(task: Task): number {
  if (!task.deadline) {
    // No deadline = medium urgency
    return 50
  }

  const deadline = new Date(task.deadline)
  const now = new Date()
  const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours < 0) return 100 // Overdue
  if (diffHours < 1) return 95 // Due within hour
  if (diffHours < 2) return 85 // Due within 2 hours
  if (diffHours < 6) return 75 // Due today
  if (diffHours < 24) return 65 // Due tomorrow
  if (diffHours < 72) return 45 // Due within 3 days
  if (diffHours < 168) return 30 // Due within week
  return 15 // Due later
}

/**
 * Calculate effort required (0-100)
 * Lower effort = higher score for this factor
 */
function calculateEffortRequired(task: Task, context: UserContext): number {
  const estimate = task.estimate || 30 // Default 30 min estimate
  const available = context.availableTimeMinutes || 480 // Default 8 hours

  // If task takes more than available time, penalize
  if (estimate > available) {
    return Math.max(0, 100 - ((estimate - available) / estimate) * 100)
  }

  // Smaller tasks are higher priority (easier wins)
  if (estimate <= 15) return 90
  if (estimate <= 30) return 80
  if (estimate <= 60) return 70
  if (estimate <= 120) return 55
  if (estimate <= 240) return 40
  return 25
}

/**
 * Calculate dependency score (0-100)
 * Tasks with blocked dependents get higher priority
 */
function calculateDependencyScore(task: Task): number {
  // In a real implementation, we'd query the database for dependencies
  // For now, we'll just return a moderate score
  // This should be enhanced to use the dependency graph
  const hasDependents = task.sub_tasks && task.sub_tasks.length > 0
  return hasDependents ? 70 : 40
}

/**
 * Calculate energy match (0-100)
 * Tasks matching user's current energy level get higher scores
 */
function calculateEnergyMatch(task: Task, context: UserContext): number {
  const estimate = task.estimate || 30

  // Get current hour
  const now = new Date()
  const currentHour = now.getHours()

  // Define energy windows
  const morningHigh = currentHour >= 6 && currentHour < 11 // 6am - 11am: high energy
  const afternoonMedium = currentHour >= 11 && currentHour < 15 // 11am - 3pm: medium energy
  const eveningLow = currentHour >= 15 || currentHour < 6 // 3pm+: low energy

  // Complex tasks (>60 min) need high energy
  if (estimate > 60) {
    if (context.energyLevel === 'high') return 90
    if (morningHigh && context.energyLevel !== 'low') return 80
    if (afternoonMedium && context.energyLevel !== 'low') return 60
    if (eveningLow) return 20
    return 40
  }

  // Medium tasks (30-60 min) need medium-high energy
  if (estimate > 30) {
    if (context.energyLevel === 'high') return 85
    if (context.energyLevel === 'medium') return 75
    if (morningHigh) return 70
    if (eveningLow) return 35
    return 50
  }

  // Quick tasks (<30 min) can be done at any energy level
  return 90
}

/**
 * Calculate project phase score (0-100)
 * Tasks in early project phases get higher priority
 */
function calculateProjectPhase(task: Task): number {
  // Tasks with subtasks are likely project starters
  if (task.sub_tasks && task.sub_tasks.length > 0) {
    // Check if any subtasks are incomplete
    const incompleteSubs = task.sub_tasks.filter(s => !s.completed)
    if (incompleteSubs.length > 0) {
      return 80
    }
  }

  // Tasks in a dependency chain (has parent or children)
  if (task.parent_task_id) return 60

  return 50
}

/**
 * Calculate historical pattern score (0-100)
 * Uses user's historical data to predict priority
 */
async function calculateHistoricalPattern(task: Task, context: UserContext): Promise<number> {
  const history = context.productivityHistory
  if (!history || history.length === 0) {
    return 50 // No history to learn from
  }

  // Compare today against the user's typical daily load. On days the user
  // historically does a lot of work, give deep work a boost; on lighter days,
  // favour quicker wins.
  const totalTasks = history.reduce((sum, h) => sum + h.taskCount, 0)
  const averageDaily = totalTasks / history.length
  const today = new Date().toISOString().split('T')[0]
  const todayEntry = history.find(h => h.date === today)
  const todayLoad = todayEntry ? todayEntry.taskCount : averageDaily

  if (averageDaily <= 0) return 50

  const loadRatio = todayLoad / averageDaily
  const estimate = task.estimate || 30

  if (loadRatio >= 1) {
    // Historically busy day: complex work is achievable
    return estimate > 60 ? 70 : 55
  }
  // Lighter day: prefer quick wins
  return estimate <= 30 ? 65 : 40
}

/**
 * Calculate priority tag score (0-100)
 * User-set priority tags get weighted scores
 */
/**
 * Calculate cognitive load budget score (0-100).
 * Lower score = higher cognitive load = more mental overhead.
 *
 * Heavy tasks (many subtasks, dependencies, attachments, labels, long
 * descriptions) consume more working memory and context-switching budget.
 * Light tasks are good candidates for quick-scheduling between heavier work.
 *
 * Each dimension is capped individually so no single factor dominates.
 */
function calculateCognitiveLoad(task: Task): number {
  let load = 0

  // Subtasks: each one adds mental tracking overhead
  const subCount = task.sub_tasks?.length ?? 0
  load += Math.min(subCount * 15, 60) // cap at 4 subs (60)

  // Dependencies: blocked/blocking tasks add graph-traversal overhead
  const depCount = 0 // dependencies are queried separately; estimate from sub_tasks
  // If the task has subtasks, it's likely part of a dependency graph
  if (task.parent_task_id) {
    load += 20
  }

  // Attachments: external context to load/reconcile
  const attachCount = task.attachments?.length ?? 0
  load += Math.min(attachCount * 5, 25) // cap at 5 attachments

  // Labels: each label is a context-switch cue
  const labelCount = task.labels?.length ?? 0
  load += Math.min(labelCount * 5, 25) // cap at 5 labels

  // Description length: longer text = more to parse/retain
  const wordCount = task.description ? task.description.split(/\s+/).length : 0
  load += Math.min(wordCount / 20, 10) // cap at 200 words

  // Invert: lower load = higher score (good for slotting into tight gaps)
  return Math.round(100 - Math.min(load, 100))
}

function calculatePriorityTag(task: Task): number {
  switch (task.priority) {
    case 'high':
      return 100
    case 'medium':
      return 70
    case 'low':
      return 40
    case 'none':
    default:
      return 50
  }
}

/**
 * Generate actionable recommendations based on factor scores
 */
function generateRecommendations(
  factors: Record<keyof PriorityFactors, number>,
  task: Task,
  context: UserContext
): string[] {
  const recommendations: string[] = []

  if (factors.deadlineUrgency > 80) {
    recommendations.push('Task is urgent - do it immediately')
  }

  if (factors.effortRequired > 75) {
    recommendations.push('Quick task - great for your current energy level')
  }

  if (factors.energyMatch < 50) {
    recommendations.push('Consider scheduling this for higher-energy time')
  }

  if (context.energyLevel === 'low' && factors.effortRequired > 60 && factors.deadlineUrgency < 50) {
    recommendations.push('Good candidate for delegation or deferral')
  }

  if (task.sub_tasks && task.sub_tasks.length > 0) {
    recommendations.push('Parent task - consider breaking into smaller steps')
  }

  if (factors.cognitiveLoad < 40) {
    recommendations.push('High cognitive load - schedule during peak energy hours')
  } else if (factors.cognitiveLoad > 80) {
    recommendations.push('Lightweight task - good for filling gaps between heavy work')
  }

  return recommendations
}

/**
 * Batch prioritize tasks with sorting
 * Returns tasks sorted by priority score
 */
export async function batchPrioritize(
  tasks: Task[],
  context: UserContext
): Promise<{ task: Task; priority: TaskPriority }[]> {
  const results = await Promise.all(
    tasks.map(async (task) => ({
      task,
      priority: await calculateTaskPriority(task, context),
    }))
  )

  return results.sort((a, b) => b.priority.score - a.priority.score)
}

/**
 * Suggest optimal time to work on a task
 */
export function suggestOptimalTime(task: Task, context: UserContext): string | null {
  const estimate = task.estimate || 30
  const now = new Date()

  // For quick tasks, suggest "now"
  if (estimate <= 15) {
    return 'now'
  }

  // For high-energy tasks, suggest morning
  if (estimate > 60 && context.energyLevel === 'high') {
    return 'morning'
  }

  // For medium tasks, suggest afternoon
  if (estimate > 30) {
    const hour = now.getHours()
    if (hour >= 13 && hour < 17) {
      return 'now'
    }
    return 'this afternoon'
  }

  return 'anytime'
}