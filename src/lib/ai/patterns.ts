/**
 * User Pattern Learning System
 * Learns from user behavior to provide personalized AI features
 */

import { Task, TaskLog } from '@/types'

/**
 * User pattern data structure
 * Stores learned patterns for personalization
 */
export interface UserPattern {
  // Task completion patterns
  completedTasks: {
    id: string
    name: string
    date: string
    estimate: number
    actualTime: number
    priority: string
    completedAt: string
    dayOfWeek: number
    hourOfDay: number
  }[]

  // Energy patterns
  energyPatterns: {
    optimalTimes: string[] // e.g., ["9:00-11:00", "14:00-16:00"]
    lowEnergyTimes: string[]
    averageSessionLength: number
    preferredBreakLength: number
  }

  // Work patterns
  workPatterns: {
    focusDays: number[]
    peakEnergyHours: number[]
    contextSwitchCost: number
  }

  // Categorization patterns
  categoryPatterns: Map<string, {
    averageEstimate: number
    averageActual: number
    commonTags: string[]
    preferredList: string
  }>

  // Scheduling patterns
  schedulingPatterns: {
    preferredDays: number[] // 0-6
    preferredHours: number[] // 0-23
    batchingTendency: number // 0-1
  }

  // Productivity metrics
  productivityMetrics: {
    averageDailyTasks: number
    completionRate: number
    streakDays: number
    longestStreak: number
    totalFocusTime: number
  }

  // AI Model metadata
  modelVersion: number
  lastUpdated: number
  trainingDataPoints: number
}

/**
 * Default empty pattern
 */
const DEFAULT_PATTERN: UserPattern = {
  completedTasks: [],
  energyPatterns: {
    optimalTimes: ['9:00-11:00', '14:00-16:00'],
    lowEnergyTimes: ['13:00-14:00', '17:00-19:00'],
    averageSessionLength: 90,
    preferredBreakLength: 15,
  },
  workPatterns: {
    focusDays: [1, 2, 3, 4, 5],
    peakEnergyHours: [9, 10, 14, 15],
    contextSwitchCost: 15,
  },
  categoryPatterns: new Map(),
  schedulingPatterns: {
    preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
    preferredHours: [9, 10, 11, 14, 15, 16],
    batchingTendency: 0.5,
  },
  productivityMetrics: {
    averageDailyTasks: 5,
    completionRate: 0.7,
    streakDays: 0,
    longestStreak: 0,
    totalFocusTime: 0,
  },
  modelVersion: 1,
  lastUpdated: Date.now(),
  trainingDataPoints: 0,
}

// Storage key for patterns
const PATTERNS_KEY = 'taskflow_ai_patterns'
const PATTERNS_VERSION = 1

/**
 * Get stored user patterns
 */
export function getUserPatterns(): UserPattern {
  if (typeof window === 'undefined') return DEFAULT_PATTERN

  try {
    const stored = localStorage.getItem(PATTERNS_KEY)
    if (!stored) return DEFAULT_PATTERN

    const parsed = JSON.parse(stored)

    // Convert categoryPatterns back to Map
    if (parsed.categoryPatterns && typeof parsed.categoryPatterns === 'object') {
      parsed.categoryPatterns = new Map(Object.entries(parsed.categoryPatterns))
    }

    // Check version
    if (parsed.modelVersion !== PATTERNS_VERSION) {
      // Migration logic would go here
      return migratePatterns(parsed)
    }

    return parsed
  } catch {
    return DEFAULT_PATTERN
  }
}

/**
 * Update user patterns with new data
 */
export function updatePatterns(
  updates: Partial<UserPattern>,
  task?: Task,
  log?: TaskLog
): UserPattern {
  const current = getUserPatterns()
  const updated = { ...current, ...updates, lastUpdated: Date.now() }

  // If we have a task, update completion patterns
  if (task && log && log.action === 'completed') {
    // Patterns must reflect when the task was actually completed, not when
    // this update happens to run (which can be much later).
    const completedAt = task.completed_at ? new Date(task.completed_at) : new Date()

    const completedTask = {
      id: task.id,
      name: task.name,
      date: completedAt.toISOString().split('T')[0],
      estimate: task.estimate || 0,
      actualTime: task.actual_time,
      priority: task.priority,
      completedAt: completedAt.toISOString(),
      dayOfWeek: completedAt.getDay(),
      hourOfDay: completedAt.getHours(),
    }

    updated.completedTasks = [completedTask, ...updated.completedTasks].slice(0, 1000)
    updated.trainingDataPoints++

    // Update category patterns
    updateCategoryPatterns(updated, task)

    // Update energy patterns
    updateEnergyPatterns(updated, task, completedAt)

    // Update scheduling patterns
    updateSchedulingPatterns(updated, completedAt)

    // Update productivity metrics
    updateProductivityMetrics(updated)
  }

  // Save to localStorage
  if (typeof window !== 'undefined') {
    try {
      const toStore = {
        ...updated,
        categoryPatterns: Object.fromEntries(updated.categoryPatterns),
      }
      localStorage.setItem(PATTERNS_KEY, JSON.stringify(toStore))
    } catch (error) {
      console.error('Failed to save patterns:', error)
    }
  }

  return updated
}

/**
 * Update category patterns based on task
 */
function updateCategoryPatterns(patterns: UserPattern, task: Task): void {
  // Extract category from tags/labels
  const category = task.labels?.[0]?.name || 'general'

  let catPattern = patterns.categoryPatterns.get(category)
  if (!catPattern) {
    catPattern = {
      averageEstimate: 0,
      averageActual: 0,
      commonTags: [],
      preferredList: task.list?.name || 'inbox',
    }
  }

  const count = patterns.completedTasks.filter(t =>
    t.name.toLowerCase().includes(category.toLowerCase())
  ).length + 1

  // Update running averages
  catPattern.averageEstimate = ((catPattern.averageEstimate * (count - 1)) + (task.estimate || 0)) / count
  catPattern.averageActual = ((catPattern.averageActual * (count - 1)) + task.actual_time) / count

  // Update common tags
  if (task.labels) {
    for (const label of task.labels) {
      if (!catPattern.commonTags.includes(label.name)) {
        catPattern.commonTags.push(label.name)
      }
    }
  }

  patterns.categoryPatterns.set(category, catPattern)
}

/**
 * Update energy patterns based on task completion
 */
function updateEnergyPatterns(patterns: UserPattern, task: Task, completedAt: Date): void {
  const hour = completedAt.getHours()
  const actualTime = task.actual_time || task.estimate || 30

  // Track which hours user completes tasks quickly (high energy)
  const efficiency = actualTime / Math.max(task.estimate || 1, 1)

  if (efficiency <= 0.8) {
    // Task completed faster than estimated = high energy
    const timeSlot = `${hour}:00-${hour + 1}:00`
    if (!patterns.energyPatterns.optimalTimes.includes(timeSlot)) {
      patterns.energyPatterns.optimalTimes.push(timeSlot)
    }
  } else if (efficiency > 1.5) {
    // Task took much longer = low energy
    const timeSlot = `${hour}:00-${hour + 1}:00`
    if (!patterns.energyPatterns.lowEnergyTimes.includes(timeSlot)) {
      patterns.energyPatterns.lowEnergyTimes.push(timeSlot)
    }
  }
}

/**
 * Update scheduling patterns
 */
function updateSchedulingPatterns(patterns: UserPattern, completedAt: Date): void {
  const day = completedAt.getDay()
  const hour = completedAt.getHours()

  if (!patterns.schedulingPatterns.preferredDays.includes(day)) {
    patterns.schedulingPatterns.preferredDays.push(day)
  }

  if (!patterns.schedulingPatterns.preferredHours.includes(hour)) {
    patterns.schedulingPatterns.preferredHours.push(hour)
  }
}

/**
 * Update productivity metrics
 */
function updateProductivityMetrics(patterns: UserPattern): void {
  const today = new Date().toISOString().split('T')[0]

  // Count tasks completed today
  const todayTasks = patterns.completedTasks.filter(t => t.date === today).length
  patterns.productivityMetrics.averageDailyTasks =
    (patterns.productivityMetrics.averageDailyTasks + todayTasks) / 2

  // Update streak
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const completedYesterday = patterns.completedTasks.some(t => t.date === yesterday)

  if (completedYesterday || todayTasks > 0) {
    patterns.productivityMetrics.streakDays++
  } else {
    patterns.productivityMetrics.streakDays = 0
  }

  if (patterns.productivityMetrics.streakDays > patterns.productivityMetrics.longestStreak) {
    patterns.productivityMetrics.longestStreak = patterns.productivityMetrics.streakDays
  }
}

/**
 * Migrate patterns from old version
 */
function migratePatterns(old: UserPattern): UserPattern {
  // Add any new fields that don't exist
  const migrated: UserPattern = {
    ...DEFAULT_PATTERN,
    ...old,
    modelVersion: PATTERNS_VERSION,
    categoryPatterns: old.categoryPatterns instanceof Map ? old.categoryPatterns : new Map(),
  }
  return migrated
}

/**
 * Reset all patterns (for testing or user request)
 */
export function resetPatterns(): UserPattern {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PATTERNS_KEY)
  }
  return DEFAULT_PATTERN
}

/**
 * Export patterns for backup
 */
export function exportPatterns(): string {
  const patterns = getUserPatterns()
  return JSON.stringify(patterns, (key, value) => {
    if (value instanceof Map) {
      return Object.fromEntries(value)
    }
    return value
  }, 2)
}

/**
 * Import patterns from backup
 */
export function importPatterns(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    if (parsed.categoryPatterns && typeof parsed.categoryPatterns === 'object') {
      parsed.categoryPatterns = new Map(Object.entries(parsed.categoryPatterns))
    }
    localStorage.setItem(PATTERNS_KEY, JSON.stringify({
      ...parsed,
      categoryPatterns: Object.fromEntries(parsed.categoryPatterns),
    }))
    return true
  } catch {
    return false
  }
}

/**
 * Get pattern insights for display
 */
export function getPatternInsights(): {
  mostProductiveTime: string
  averageSessionLength: number
  completionRate: string
  currentStreak: number
  longestStreak: number
  preferredTaskLength: number
} {
  const patterns = getUserPatterns()

  return {
    mostProductiveTime: patterns.energyPatterns.optimalTimes[0] || '9:00-11:00',
    averageSessionLength: patterns.energyPatterns.averageSessionLength,
    completionRate: `${Math.round(patterns.productivityMetrics.completionRate * 100)}%`,
    currentStreak: patterns.productivityMetrics.streakDays,
    longestStreak: patterns.productivityMetrics.longestStreak,
    preferredTaskLength: Math.round(
      Array.from(patterns.categoryPatterns.values()).reduce(
        (sum, p) => sum + p.averageEstimate, 0
      ) / Math.max(patterns.categoryPatterns.size, 1)
    ),
  }
}

/**
 * Analyze task naming patterns to suggest categories
 */
export function analyzeTaskNaming(tasks: Task[]): Map<string, string[]> {
  const patterns = new Map<string, string[]>()

  for (const task of tasks) {
    // Extract first word as potential category
    const firstWord = task.name.split(' ')[0].toLowerCase()
    if (firstWord.length > 2) {
      if (!patterns.has(firstWord)) {
        patterns.set(firstWord, [])
      }
      patterns.get(firstWord)!.push(task.name)
    }
  }

  // Only return patterns with 3+ occurrences
  const filtered = new Map<string, string[]>()
  for (const [key, value] of patterns) {
    if (value.length >= 3) {
      filtered.set(key, value)
    }
  }

  return filtered
}

/**
 * Predicted duration for a task, in minutes
 */
export interface CompletionTimePrediction {
  /** Predicted duration in minutes */
  predictedMinutes: number
  /** How much history backs the prediction */
  confidence: 'high' | 'medium' | 'low'
  /** Which signal the prediction came from */
  basis: 'category' | 'calibrated-estimate' | 'estimate' | 'default'
}

/**
 * Predict how long a task will take, in minutes.
 *
 * Prefers the observed average for the task's category, then falls back
 * to the task's own estimate calibrated against how the user's estimates
 * have historically over- or under-run, then the raw estimate, and
 * finally a conservative default.
 */
export function predictCompletionTime(task: Task): CompletionTimePrediction {
  const patterns = getUserPatterns()

  // 1. Category average: the strongest signal when the category is known.
  const category = task.labels?.[0]?.name || 'general'
  const categoryPattern = patterns.categoryPatterns.get(category)
  if (categoryPattern && categoryPattern.averageActual > 0) {
    return {
      predictedMinutes: Math.round(categoryPattern.averageActual),
      confidence: 'high',
      basis: 'category',
    }
  }

  // 2. Calibrated estimate: scale the estimate by observed over/under-running.
  const withTime = patterns.completedTasks.filter(
    t => t.estimate > 0 && t.actualTime > 0
  )
  if (withTime.length >= 3 && task.estimate && task.estimate > 0) {
    const totalEstimate = withTime.reduce((sum, t) => sum + t.estimate, 0)
    const totalActual = withTime.reduce((sum, t) => sum + t.actualTime, 0)
    const calibrationRatio = totalActual / totalEstimate
    return {
      predictedMinutes: Math.max(1, Math.round(task.estimate * calibrationRatio)),
      confidence: 'medium',
      basis: 'calibrated-estimate',
    }
  }

  // 3. Raw estimate: no history to correct it, but still the user's input.
  if (task.estimate && task.estimate > 0) {
    return {
      predictedMinutes: task.estimate,
      confidence: 'low',
      basis: 'estimate',
    }
  }

  // 4. No estimate and no history.
  return { predictedMinutes: 30, confidence: 'low', basis: 'default' }
}