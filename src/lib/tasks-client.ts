'use client'

import type { Task, List, Label, TaskAttachment, TaskReminder, TaskLog } from '@/types'

// Client-side task operations that call API routes

const API_BASE = '/api/tasks'

export async function getTasks(options?: {
  listId?: string
  labelId?: string
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  completed?: boolean
  search?: string
}): Promise<Task[]> {
  const params = new URLSearchParams()
  if (options?.listId) params.set('listId', options.listId)
  if (options?.labelId) params.set('labelId', options.labelId)
  if (options?.view) params.set('view', options.view)
  if (options?.completed !== undefined) params.set('completed', String(options.completed))
  if (options?.search) params.set('search', options.search)

  const response = await fetch(`${API_BASE}?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch tasks')
  }
  return response.json()
}

export async function getTask(id: string): Promise<Task | undefined> {
  const response = await fetch(`${API_BASE}/${id}`)
  if (!response.ok) {
    if (response.status === 404) return undefined
    throw new Error('Failed to fetch task')
  }
  return response.json()
}

export async function createTask(data: Partial<Task>): Promise<Task> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create task')
  }
  return response.json()
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'update', data }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update task')
  }
}

export async function toggleTaskComplete(id: string): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'toggle' }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to toggle task')
  }
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'delete' }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete task')
  }
}

export async function getLists(): Promise<List[]> {
  const response = await fetch('/api/lists')
  if (!response.ok) {
    throw new Error('Failed to fetch lists')
  }
  return response.json()
}

export async function createList(name: string, color: string, emoji: string): Promise<List> {
  const response = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color, emoji }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create list')
  }
  return response.json()
}

export async function deleteList(id: string): Promise<void> {
  const response = await fetch(`/api/lists?id=${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete list')
  }
}

export async function getLabels(): Promise<Label[]> {
  const response = await fetch('/api/labels')
  if (!response.ok) {
    throw new Error('Failed to fetch labels')
  }
  return response.json()
}

export async function createLabel(name: string, color: string, icon: string): Promise<Label> {
  const response = await fetch('/api/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color, icon }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create label')
  }
  return response.json()
}

export async function deleteLabel(id: string): Promise<void> {
  const response = await fetch(`/api/labels?id=${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete label')
  }
}

export async function searchTasks(query: string): Promise<Task[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) {
    throw new Error('Failed to search tasks')
  }
  return response.json()
}

export async function getOverdueTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks?view=all&completed=false')
  if (!response.ok) {
    throw new Error('Failed to fetch overdue tasks')
  }
  const tasks = await response.json()
  // Filter client-side for overdue
  const today = new Date().toISOString().split('T')[0]
  return tasks.filter(
    (task) =>
      !task.completed &&
      ((task.date && task.date < today) || (task.deadline && task.deadline < today))
  )
}

// Task Labels
export async function getTaskLabels(taskId: string): Promise<Label[]> {
  const response = await fetch(`/api/tasks/${taskId}/labels`)
  if (!response.ok) {
    throw new Error('Failed to fetch task labels')
  }
  return response.json()
}

export async function addTaskLabel(taskId: string, labelId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labelId }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add label')
  }
}

export async function removeTaskLabel(taskId: string, labelId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/labels/${labelId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to remove label')
  }
}

// Task Attachments
export async function getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const response = await fetch(`/api/tasks/${taskId}/attachments`)
  if (!response.ok) {
    throw new Error('Failed to fetch attachments')
  }
  return response.json()
}

export async function addTaskAttachment(
  taskId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  mimeType?: string
): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, filePath, fileSize, mimeType }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add attachment')
  }
}

export async function removeTaskAttachment(attachmentId: string): Promise<void> {
  const response = await fetch(`/api/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to remove attachment')
  }
}

// Task Reminders
export async function getTaskReminders(taskId: string): Promise<TaskReminder[]> {
  const response = await fetch(`/api/tasks/${taskId}/reminders`)
  if (!response.ok) {
    throw new Error('Failed to fetch reminders')
  }
  return response.json()
}

export async function addTaskReminder(taskId: string, reminderTime: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reminderTime }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add reminder')
  }
}

export async function removeTaskReminder(reminderId: string): Promise<void> {
  const response = await fetch(`/api/reminders/${reminderId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to remove reminder')
  }
}

// Task Logs
export async function getTaskLogs(taskId: string): Promise<TaskLog[]> {
  const response = await fetch(`/api/tasks/${taskId}/logs`)
  if (!response.ok) {
    throw new Error('Failed to fetch logs')
  }
  return response.json()
}

// Task Dependencies
export async function getTaskDependencies(taskId: string): Promise<{ blocking: Task[]; blocked: Task[] }> {
  const response = await fetch(`/api/tasks/${taskId}/dependencies`)
  if (!response.ok) {
    throw new Error('Failed to fetch dependencies')
  }
  return response.json()
}

export async function addTaskDependency(blockingTaskId: string, blockedTaskId: string, type: 'blocks' | 'relates' | 'duplicates' = 'blocks'): Promise<void> {
  const response = await fetch(`/api/tasks/${blockedTaskId}/dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockingTaskId, type }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add dependency')
  }
}

export async function removeTaskDependency(blockingTaskId: string, blockedTaskId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${blockedTaskId}/dependencies/${blockingTaskId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to remove dependency')
  }
}

export async function canCompleteTask(taskId: string): Promise<{ canComplete: boolean; blockingTasks: Task[] }> {
  const response = await fetch(`/api/tasks/${taskId}/can-complete`)
  if (!response.ok) {
    throw new Error('Failed to check if task can complete')
  }
  return response.json()
}