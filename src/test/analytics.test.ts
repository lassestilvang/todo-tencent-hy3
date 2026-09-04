"use strict"

import {
  getCompletionStats,
  getDailyStats,
  analyzeTrend,
  predictFutureStats,
  calculateProductivityScore,
  generateInsights,
} from '@/lib/analytics/trends'
import type { Task, TaskLog } from '@/types'

const mockTasks: Task[] = [
  {
    id: 'task-1',
    name: 'Task 1',
    completed: true,
    completed_at: new Date().toISOString(),
    estimate: 60,
    actual_time: 45,
    priority: 'high',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deadline: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: 'task-2',
    name: 'Task 2',
    completed: true,
    completed_at: new Date().toISOString(),
    estimate: 30,
    actual_time: 30,
    priority: 'medium',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deadline: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: 'task-3',
    name: 'Task 3',
    completed: false,
    estimate: 120,
    actual_time: null,
    priority: 'low',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deadline: new Date(Date.now() - 3600000).toISOString(), // Overdue
  },
]

const mockLogs: TaskLog[] = [
  {
    id: 'log-1',
    task_id: 'task-1',
    action: 'completed',
    details: 'Task completed',
    created_at: new Date().toISOString(),
  },
]

describe('Analytics Trends', () => {
  describe('getCompletionStats', () => {
    it('should calculate completion stats correctly', async () => {
      const stats = await getCompletionStats(mockTasks, mockLogs)

      expect(stats).toBeDefined()
      expect(stats.totalTasks).toBe(3)
      expect(stats.completedTasks).toBe(2)
      expect(stats.completionRate).toBeCloseTo(2 / 3, 5)
      expect(stats.averageTime).toBe(37.5) // (45 + 30) / 2
      expect(stats.totalTime).toBe(75)
      expect(stats.estimatedTime).toBe(90)
      expect(stats.overdueCount).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty tasks array', async () => {
      const stats = await getCompletionStats([], [])

      expect(stats.totalTasks).toBe(0)
      expect(stats.completedTasks).toBe(0)
      expect(stats.completionRate).toBe(0)
      expect(stats.averageTime).toBe(0)
      expect(stats.overdueCount).toBe(0)
    })
  })

  describe('getDailyStats', () => {
    it('should return daily stats for the last 7 days', async () => {
      const dailyStats = await getDailyStats(mockTasks, 7)

      expect(Array.isArray(dailyStats)).toBe(true)
      expect(dailyStats.length).toBeLessThanOrEqual(7)
      dailyStats.forEach((day) => {
        expect(day).toHaveProperty('date')
        expect(day).toHaveProperty('created')
        expect(day).toHaveProperty('completed')
        expect(day).toHaveProperty('totalTime')
        expect(day).toHaveProperty('estimatedTime')
        expect(day).toHaveProperty('overdue')
      })
    })
  })

  describe('analyzeTrend', () => {
    it('should analyze upward trend', () => {
      const values = [1, 2, 3, 4, 5, 6, 7]
      const result = analyzeTrend(values)

      expect(result.trend).toBe('up')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should analyze downward trend', () => {
      const values = [7, 6, 5, 4, 3, 2, 1]
      const result = analyzeTrend(values)

      expect(result.trend).toBe('down')
    })

    it('should handle insufficient data', () => {
      const values = [5]
      const result = analyzeTrend(values)

      expect(result.trend).toBe('steady')
      expect(result.confidence).toBe(0)
    })
  })

  describe('predictFutureStats', () => {
    it('should generate predictions', () => {
      const dailyStats = [
        { date: '2024-01-01', created: 5, completed: 3, totalTime: 180, estimatedTime: 150, overdue: 0, priorityBreakdown: { high: 1, medium: 2, low: 0 } },
        { date: '2024-01-02', created: 4, completed: 4, totalTime: 120, estimatedTime: 120, overdue: 0, priorityBreakdown: { high: 0, medium: 2, low: 2 } },
      ]

      const predictions = predictFutureStats(dailyStats)

      expect(Array.isArray(predictions)).toBe(true)
      predictions.forEach((pred) => {
        expect(pred).toHaveProperty('metric')
        expect(pred).toHaveProperty('predictedValue')
        expect(pred).toHaveProperty('confidence')
        expect(pred).toHaveProperty('reasoning')
      })
    })
  })

  describe('calculateProductivityScore', () => {
    it('should calculate productivity score', () => {
      const stats = {
        totalTasks: 10,
        completedTasks: 8,
        completionRate: 0.8,
        averageTime: 45,
        totalTime: 360,
        estimatedTime: 300,
        overdueCount: 1,
        streak: 5,
        longestStreak: 7,
      }
      const dailyStats = []

      const score = calculateProductivityScore(stats, dailyStats)

      expect(typeof score).toBe('number')
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('generateInsights', () => {
    it('should generate insights based on stats', () => {
      const stats = {
        totalTasks: 10,
        completedTasks: 8,
        completionRate: 0.8,
        averageTime: 45,
        totalTime: 360,
        estimatedTime: 300,
        overdueCount: 0,
        streak: 7,
        longestStreak: 10,
      }
      const dailyStats = [
        { date: '2024-01-01', created: 5, completed: 4, totalTime: 180, estimatedTime: 150, overdue: 0, priorityBreakdown: { high: 1, medium: 2, low: 1 } },
      ]

      const insights = generateInsights(mockTasks, stats, dailyStats)

      expect(Array.isArray(insights)).toBe(true)
      insights.forEach((insight) => {
        expect(typeof insight).toBe('string')
        expect(insight.length).toBeGreaterThan(0)
      })
    })
  })
})