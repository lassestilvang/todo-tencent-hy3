'use server'

import {
  createTask,
  createList,
  toggleTaskComplete,
  deleteTask,
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
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  listId: z.string().optional(),
})

export async function createTaskAction(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    date: formData.get('date') as string,
    priority: formData.get('priority') as Priority,
    listId: formData.get('listId') as string,
  }

  const result = createTaskSchema.safeParse(raw)
  if (!result.success) {
    throw new Error('Invalid task data - please check your input')
  }

  const { name, description, date, priority, listId } = result.data
  const validPriority: Priority =
    priority && validPriorities.includes(priority) ? priority : 'none'

  createTask({
    name: name.trim(),
    description: description || undefined,
    date: date || undefined,
    priority: validPriority,
    list_id: listId || undefined,
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
