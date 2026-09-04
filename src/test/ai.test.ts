"use strict"

import { calculateTaskPriority, type UserContext } from '@/lib/ai/task-prioritizer'
import { getUserPatterns, updatePatterns } from '@/lib/ai/patterns'
import { generateEmbeddings, semanticSimilarity, findSimilarTasks } from '@/lib/ai/embeddings'
import { Task } from '@/types'

const mockTask: Task = {
  id: 'test-task-1',
  name: 'Test Task',
  description: 'A test task for AI prioritization',
  priority: 'medium',
  completed: false,
  estimate: 60,
  actual_time: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deadline: new Date(Date.now() + 86400000).toISOString(),
}

describe('AI Task Prioritizer', () => {
  const mockContext: UserContext = {
    energyLevel: 'high',
    availableTimeMinutes: 480,
    focusMode: false,
    workHoursStart: 9,
    workHoursEnd: 17,
    productivityHistory: [],
  }

  describe('calculateTaskPriority', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should calculate priority for a medium task', async () => {
      const result = await calculateTaskPriority(mockTask, mockContext)

      expect(result).toBeDefined()
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.factors).toBeDefined()
      expect(result.recommendations).toBeInstanceOf(Array)
    })

    it('should give higher priority for overdue tasks', async () => {
      const overdueTask: Task = {
        ...mockTask,
        deadline: new Date(Date.now() - 3600000).toISOString(), // Overdue
      }

      const result = await calculateTaskPriority(overdueTask, mockContext)

      expect(result.score).toBeGreaterThan(50)
    })

    it('should consider task dependencies in priority calculation', async () => {
      const taskWithDependencies: Task = {
        ...mockTask,
        id: 'task-with-deps',
      }

      const result = await calculateTaskPriority(taskWithDependencies, mockContext)

      expect(result.factors).toHaveProperty('dependencies')
    })
  })
})

describe('User Patterns', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should get and update user patterns', async () => {
    const patterns = await getUserPatterns()

    expect(patterns).toBeDefined()
    expect(patterns.energyPatterns).toBeDefined()
    expect(patterns.workPatterns).toBeDefined()
  })

  it('should update user patterns with new data', async () => {
    const updates = {
      energyPatterns: {
        peakHours: [9, 10, 74, 2, 14, 15],
        energyLevels: ['high', 'medium', 'low'],
        optimalTimes: ['09:00', '14:00'],
      },
      workPatterns: {
        focusDays: [1, 2, 3, 4, 5],
        taskCompletionTimes: { hourly: [] },
      },
    }

    const result = await updatePatterns(updates, mockTask)

    expect(result).toBeDefined()
  })
})

describe('Embeddings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should generate embeddings for text', () => {
    const embeddings = generateEmbeddings('test text')

    expect(embeddings).toBeDefined()
    expect(Array.isArray(embeddings)).toBe(true)
    expect(embeddings.length).toBe(64)
    expect(embeddings.every(val => typeof val === 'number')).toBe(true)
  })

  it('should calculate semantic similarity between texts', () => {
    const text1 = 'test task one'
    const text2 = 'test task two'

    const similarity = semanticSimilarity(text1, text2)

    expect(typeof similarity).toBe('number')
    expect(similarity).toBeGreaterThanOrEqual(0)
    expect(similarity).toBeLessThanOrEqual(1)
  })

  it('should find similar tasks', () => {
    const tasks: Task[] = [
      { ...mockTask, id: 'task1', name: 'First task' },
      { ...mockTask, id: 'task2', name: 'Second task' },
      { ...mockTask, id: 'task3', name: 'Different task' },
    ]

    const similar = findSimilarTasks(tasks)

    expect(Array.isArray(similar)).toBe(true)
    expect(similar.length).toBeGreaterThanOrEqual(0)
    expect(similar.every((id: string) => tasks.some(t => t.id === id))).toBe(true)
  })
})