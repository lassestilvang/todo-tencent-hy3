import { describe, test, expect, beforeEach } from 'bun:test'
import { resetDb } from '@/lib/db'
import { createTask, getTask, toggleTaskComplete,
  addTaskAttachment, getTaskAttachments,
  getOverdueTasks, searchTasks,
} from '@/lib/tasks'

describe('Advanced Task Tests', () => {
  beforeEach(() => {
    resetDb()
  })

  test('should create task with all fields', () => {
    const task = createTask({
      name: 'Complete Task',
      description: 'A complete task',
      date: '2026-04-23',
      priority: 'high',
    })
    expect(task.name).toBe('Complete Task')
    expect(task.description).toBe('A complete task')
    expect(task.date).toBe('2026-04-23')
    expect(task.priority).toBe('high')
  })

  test('should handle sub-tasks', () => {
    const parent = createTask({ name: 'Parent' })
    createTask({ name: 'Sub 1', parent_task_id: parent.id })
    createTask({ name: 'Sub 2', parent_task_id: parent.id })
    const retrieved = getTask(parent.id)
    expect(retrieved?.sub_tasks?.length).toBe(2)
  })

  test('should toggle complete with sub-tasks', () => {
    const parent = createTask({ name: 'Parent' })
    createTask({ name: 'Sub', parent_task_id: parent.id })
    toggleTaskComplete(parent.id)
    const retrieved = getTask(parent.id)
    expect(retrieved?.completed).toBe(1)
    expect(retrieved?.sub_tasks?.[0].completed).toBe(1)
  })

  test('should add attachments', () => {
    const task = createTask({ name: 'Task' })
    addTaskAttachment(task.id, 'file.pdf', '/uploads/file.pdf', 1024, 'application/pdf')
    const attachments = getTaskAttachments(task.id)
    expect(attachments.length).toBe(1)
  })

  test('should get overdue tasks', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    createTask({ name: 'Overdue', date: yesterday })
    const overdue = getOverdueTasks()
    expect(overdue.length).toBe(1)
  })

  test('should search tasks', () => {
    createTask({ name: 'Buy groceries', description: 'Milk' })
    const results = searchTasks('groceries')
    expect(results.length).toBe(1)
  })
})
