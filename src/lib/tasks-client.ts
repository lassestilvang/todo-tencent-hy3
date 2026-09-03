'use client'

import type { Task, List, Label, TaskLog } from '@/types'
import useSWR from 'swr'

// Client-side task operations that call API routes.
// Mutations are primarily handled by server actions in @/lib/actions.ts;
// the functions here serve the components that fetch via HTTP.

const API_BASE = '/api/tasks'

// SWR fetcher function
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch')
  }
  return res.json()
}

// SWR cache keys
const keys = {
  tasks: (options?: { listId?: string; labelId?: string; view?: string; completed?: boolean; search?: string }) =>
    ['/api/tasks', options],
  lists: () => ['/api/lists'],
  labels: () => ['/api/labels'],
}

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
  const tasks = await response.json() as Task[]
  // Filter client-side for overdue
  const today = new Date().toISOString().split('T')[0]
  return tasks.filter(
    (task: Task) =>
      !task.completed &&
      ((task.date && task.date < today) || (task.deadline && task.deadline < today))
  )
}

// Get all task logs for analytics (bulk endpoint)
export async function getAllTaskLogs(): Promise<TaskLog[]> {
  const response = await fetch('/api/task-logs')
  if (!response.ok) {
    throw new Error('Failed to fetch logs')
  }
  return response.json()
}

// Task Dependencies
// These call the per-task sub-routes (/api/tasks/{id}/dependencies, ...)
// implemented in src/app/api/tasks/[id]/. They are used by the
// task-dependencies component, rendered on the task detail page.
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

/**
 * SWR hooks for data caching and revalidation
 */

export function useTasks(options?: Parameters<typeof getTasks>[0]) {
  const key = keys.tasks(options)
  return useSWR<Task[], Error>(key, () => getTasks(options))
}

export function useLists() {
  return useSWR<List[], Error>(keys.lists(), fetcher)
}

export function useLabels() {
  return useSWR<Label[], Error>(keys.labels(), fetcher)
}
