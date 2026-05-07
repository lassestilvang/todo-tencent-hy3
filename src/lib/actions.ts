'use server'

import {
  createTask,
  createList,
  toggleTaskComplete,
  deleteTask,
  clearCompletedTasks,
} from '@/lib/tasks'
import type { Priority } from '@/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const validPriorities: Priority[] = ['high', 'medium', 'low', 'none']

const createTaskSchema = z.object({
  name: z
    .string()
    .min(1, 'Task name is required')
    .max(500, 'Task name is too long'),
  description: z.string().max(5000, 'Description is too long').optional(),
  date: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  listId: z.string().optional(),
  estimate: z.coerce
    .number()
    .min(1, 'Estimate must be at least 1 minute')
    .max(9999, 'Estimate is too large')
    .optional(),
})

export async function createTaskAction(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    date: formData.get('date') as string,
    deadline: formData.get('deadline') as string,
    priority: formData.get('priority') as Priority,
    listId: formData.get('listId') as string,
    estimate: formData.get('estimate') as string,
  }

  const result = createTaskSchema.safeParse(raw)
  if (!result.success) {
    throw new Error('Invalid task data - please check your input')
  }

  const { name, description, date, deadline, priority, listId, estimate } =
    result.data
  const validPriority: Priority =
    priority && validPriorities.includes(priority) ? priority : 'none'

  createTask({
    name: name.trim(),
    description: description || undefined,
    date: date || undefined,
    deadline: deadline || undefined,
    priority: validPriority,
    list_id: listId || undefined,
    estimate: estimate || undefined,
  })

  revalidatePath('/')
}

export async function createListAction(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    throw new Error('List name is required')
  }
  if (name.length > 50) {
    throw new Error('List name is too long')
  }
  const color = formData.get('color') as string
  const emoji = formData.get('emoji') as string

  createList(name, color || '#6366f1', emoji || '📋')

  revalidatePath('/')
}

export async function handleToggle(taskId: string) {
  if (!taskId) return
  toggleTaskComplete(taskId)
  revalidatePath('/')
}

export async function handleDelete(taskId: string) {
  if (!taskId) return
  deleteTask(taskId)
  redirect('/')
}

export async function handleClearCompleted() {
  clearCompletedTasks()
  revalidatePath('/')
}
