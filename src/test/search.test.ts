import { describe, test, expect, beforeEach } from 'bun:test'
import { resetDb } from '@/lib/db'
import { createTask, searchTasks } from '@/lib/tasks'

describe('Search Tests', () => {
  beforeEach(() => {
    resetDb()
  })

  test('should find task by name', () => {
    createTask({ name: 'Buy groceries' })
    createTask({ name: 'Finish report' })
    const results = searchTasks('report')
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Finish report')
  })

  test('should find task by description', () => {
    createTask({ name: 'Task 1', description: 'Contains special keyword' })
    createTask({ name: 'Task 2', description: 'Nothing here' })
    const results = searchTasks('special')
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Task 1')
  })

  test('should return empty for no matches', () => {
    createTask({ name: 'Task' })
    const results = searchTasks('nonexistent')
    expect(results.length).toBe(0)
  })

  test('should be case insensitive', () => {
    createTask({ name: 'IMPORTANT Task' })
    const results = searchTasks('important')
    expect(results.length).toBe(1)
  })

  test('should limit results to 50', () => {
    for (let i = 0; i < 60; i++) {
      createTask({ name: `Task ${i}` })
    }
    const results = searchTasks('Task')
    expect(results.length).toBe(50)
  })
})
