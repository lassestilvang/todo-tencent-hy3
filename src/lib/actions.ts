'use server'

import { createTask, createList, toggleTaskComplete, deleteTask } from '@/lib/tasks'
import type { Priority } from '@/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const validPriorities: Priority[] = ['high', 'medium', 'low', 'none']

const createTaskSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
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
    throw new Error('Invalid task data')
  }

  const { name, description, date, priority, listId } = result.data
  const validPriority: Priority = priority && validPriorities.includes(priority) ? priority : 'none'

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
  const name = formData.get('name') as string
  if (!name || name.trim() === '') {
    throw new Error('List name is required')
  }
  const color = formData.get('color') as string
  const emoji = formData.get('emoji') as string

  createList(name.trim(), color || '#6366f1', emoji || '📋')

  revalidatePath('/')
}

export async function handleToggle(taskId: string) {
  toggleTaskComplete(taskId)
  revalidatePath('/')
}

export async function handleDelete(taskId: string) {
  deleteTask(taskId)
  redirect('/')
}
