import { describe, test, expect, beforeEach } from 'bun:test'
import { resetDb } from '@/lib/db'
import { createTask, getTasks, getTask, updateTask, toggleTaskComplete, deleteTask } from '@/lib/tasks'

describe('Task Tests', () => {
  beforeEach(() => {
    resetDb()
  })

  test('should create task', () => {
    const task = createTask({ name: 'Test Task' })
    expect(task).toBeDefined()
    expect(task.name).toBe('Test Task')
    expect(task.completed).toBe(0)
  })

  test('should get tasks', () => {
    createTask({ name: 'Task 1' })
    createTask({ name: 'Task 2' })
    const tasks = getTasks()
    expect(tasks.length).toBe(2)
  })

  test('should get task by id', () => {
    const task = createTask({ name: 'Test' })
    const retrieved = getTask(task.id)
    expect(retrieved).toBeDefined()
    expect(retrieved?.name).toBe('Test')
  })

  test('should update task', () => {
    const task = createTask({ name: 'Original' })
    updateTask(task.id, { name: 'Updated' })
    const updated = getTask(task.id)
    expect(updated?.name).toBe('Updated')
  })

  test('should toggle complete', () => {
    const task = createTask({ name: 'Complete Me' })
    expect(task.completed).toBe(0)
    toggleTaskComplete(task.id)
    const updated = getTask(task.id)
    expect(updated?.completed).toBe(1)
  })

  test('should delete task', () => {
    const task = createTask({ name: 'Delete Me' })
    deleteTask(task.id)
    const deleted = getTask(task.id)
    expect(deleted).toBeUndefined()
  })
})
