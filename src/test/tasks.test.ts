"use client"

import { getTasks } from '@/lib/tasks'

// Mock the database
jest.mock('@/lib/db', () => ({
  getDb: () => ({
    tasks: [
      {
        id: 'task-1',
        name: 'Test Task 1',
        description: 'Description for task 1',
        date: '2025-01-15',
        deadline: null,
        estimate: 60,
        actual_time: 30,
        priority: 'high',
        recurring: null,
        list_id: 'inbox',
        parent_task_id: null,
        completed: false,
        completed_at: null,
        position: 0,
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
      },
      {
        id: 'task-2',
        name: 'Test Task 2',
        description: 'Description for task 2',
        date: '2025-01-20',
        deadline: null,
        estimate: 30,
        actual_time: 15,
        priority: 'medium',
        recurring: null,
        list_id: 'inbox',
        parent_task_id: null,
        completed: true,
        completed_at: '2025-01-15T14:00:00Z',
        position: 1,
        created_at: '2025-01-01T11:00:00Z',
        updated_at: '2025-01-15T14:00:00Z',
      },
    ],
    lists: [
      { id: 'inbox', name: 'Inbox', color: '#6366F1', emoji: '📥', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
      { id: 'today', name: 'Today', color: '#10B981', emoji: '📅', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    ],
    labels: [],
    task_labels: [],
    task_attachments: [],
    task_reminders: [],
    task_logs: [],
  }),
  queryLists: () => [],
  queryLabels: () => [],
  insertTask: jest.fn(),
  updateTask: jest.fn(),
  updateTasks: jest.fn(),
  deleteTask: jest.fn(),
  deleteTasks: jest.fn(),
  insertList: jest.fn(),
  deleteList: jest.fn(),
  insertLabel: jest.fn(),
  deleteLabel: jest.fn(),
  insertTaskLabel: jest.fn(),
  deleteTaskLabel: jest.fn(),
  getTaskLabels: () => [],
  insertAttachment: jest.fn(),
  deleteAttachment: jest.fn(),
  getTaskAttachments: () => [],
  insertReminder: jest.fn(),
  deleteReminder: jest.fn(),
  getTaskReminders: () => [],
  insertLog: jest.fn(),
  getTaskLogs: () => [],
}))

describe('getTasks function', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns all tasks when no options provided', () => {
    const result = getTasks()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Test Task 1')
    expect(result[1].name).toBe('Test Task 2')
  })

  it('filters tasks by listId', () => {
    const result = getTasks({ listId: 'inbox' })

    expect(result).toHaveLength(2)
    expect(result.every(task => task.list_id === 'inbox')).toBe(true)
  })

  it('filters tasks by completed status', () => {
    const result = getTasks({ completed: false })

    expect(result).toHaveLength(1)
    expect(result[0].completed).toBe(false)
  })

  it('filters tasks by search', () => {
    const result = getTasks({ search: 'Test Task 1' })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Task 1')
  })

  it('sorts tasks by priority', () => {
    const result = getTasks()

    expect(result[0].priority).toBe('high')
    expect(result[1].priority).toBe('medium')
  })
})