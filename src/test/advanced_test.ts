import { describe, test, expect, beforeEach } from 'bun:test'
import { getDb, closeDb } from '@/lib/db'
import {
  createTask, getTasks, getTask, updateTask, toggleTaskComplete, deleteTask,
  createList, getLists, createLabel, addTaskLabel, removeTaskLabel,
  addTaskAttachment, removeTaskAttachment, getTaskAttachments,
  addTaskReminder, removeTaskReminder, getTaskReminders,
  getOverdueTasks, searchTasks,
} from '@/lib/tasks'

describe('Advanced Task Tests', () => {
  beforeEach(() => {
    closeDb()
    const fs = require('fs')
    const path = require('path')
    const dbPath = process.env.TEST_DB_PATH || path.join(__dirname, '../../tasks.json')
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
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

  test('should add labels to task', () => {
    const task = createTask({ name: 'Task with Labels' })
    const label = createLabel('Urgent', '#ff0000', '🚨')
    addTaskLabel(task.id, label.id)
    const retrieved = getTask(task.id)
    expect(retrieved?.labels?.length).toBe(1)
  })

  test('should remove labels from task', () => {
    const task = createTask({ name: 'Task' })
    const label = createLabel('Urgent', '#ff0000', '🚨')
    addTaskLabel(task.id, label.id)
    removeTaskLabel(task.id, label.id)
    const retrieved = getTask(task.id)
    expect(retrieved?.labels?.length).toBe(0)
  })

  test('should add attachments', () => {
    const task = createTask({ name: 'Task' })
    addTaskAttachment(task.id, 'file.pdf', '/uploads/file.pdf', 1024, 'application/pdf')
    const attachments = getTaskAttachments(task.id)
    expect(attachments.length).toBe(1)
    expect(attachments[0].file_name).toBe('file.pdf')
  })

  test('should remove attachment', () => {
    const task = createTask({ name: 'Task' })
    addTaskAttachment(task.id, 'file.pdf', '/uploads/file.pdf', 1024)
    const attId = getTask(task.id)?.attachments?.[0].id
    if (attId) {
      removeTaskAttachment(attId)
    }
    const attachments = getTaskAttachments(task.id)
    expect(attachments.length).toBe(0)
  })

  test('should add reminder', () => {
    const task = createTask({ name: 'Task' })
    addTaskReminder(task.id, '2026-04-23T10:00:00')
    const reminders = getTaskReminders(task.id)
    expect(reminders.length).toBe(1)
  })

  test('should get overdue tasks', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    createTask({ name: 'Overdue', date: yesterday })
    const overdue = getOverdueTasks()
    expect(overdue.length).toBe(1)
    expect(overdue[0].name).toBe('Overdue')
  })

  test('should search tasks', () => {
    createTask({ name: 'Buy groceries', description: 'Milk' })
    createTask({ name: 'Finish report' })
    const results = searchTasks('groceries')
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Buy groceries')
  })

  test('should handle sub-tasks', () => {
    const parent = createTask({ name: 'Parent' })
    createTask({ name: 'Sub 1', parent_task_id: parent.id })
    createTask({ name: 'Sub 2', parent_task_id: parent.id })
    const retrieved = getTask(parent.id)
    expect(retrieved?.sub_tasks?.length).toBe(2)
  })

  test('should toggle parent completes sub-tasks', () => {
    const parent = createTask({ name: 'Parent' })
    createTask({ name: 'Sub', parent_task_id: parent.id })
    toggleTaskComplete(parent.id)
    const retrieved = getTask(parent.id)
    expect(retrieved?.completed).toBe(1)
    expect(retrieved?.sub_tasks?.[0].completed).toBe(1)
  })
})
