'use server'

import {
  createTask,
  updateTask as updateTaskInDb,
  createList,
  toggleTaskComplete,
  deleteTask,
  clearCompletedTasks,
  getLists,
} from '@/lib/tasks'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export async function getListsAction() {
  return getLists()
}

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
    priority: formData.get('priority') as string,
    listId: formData.get('listId') as string,
    estimate: formData.get('estimate') as string,
  }

  const result = createTaskSchema.safeParse(raw)
  if (!result.success) {
    return { success: false, errors: result.error.flatten().fieldErrors }
  }

  const { name, description, date, deadline, priority, listId, estimate } =
    result.data

  createTask({
    name: name.trim(),
    description: description || undefined,
    date: date || undefined,
    deadline: deadline || undefined,
    priority: priority ?? 'none',
    list_id: listId || undefined,
    estimate: estimate || undefined,
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateTaskAction(taskId: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    date: formData.get('date') as string,
    deadline: formData.get('deadline') as string,
    priority: formData.get('priority') as string,
    listId: formData.get('listId') as string,
    estimate: formData.get('estimate') as string,
  }

  const result = createTaskSchema.safeParse(raw)
  if (!result.success) {
    return { success: false, errors: result.error.flatten().fieldErrors }
  }

  const { name, description, date, deadline, priority, listId, estimate } =
    result.data

  updateTaskInDb(taskId, {
    name: name.trim(),
    description: description || undefined,
    date: date || undefined,
    deadline: deadline || undefined,
    priority: priority ?? 'none',
    list_id: listId || undefined,
    estimate: estimate || undefined,
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

const createListSchema = z.object({
  name: z
    .string()
    .min(1, 'List name is required')
    .max(50, 'List name is too long'),
  color: z.string().optional(),
  emoji: z.string().optional(),
})

export async function createListAction(formData: FormData) {
  const result = createListSchema.safeParse({
    name: formData.get('name'),
    color: formData.get('color'),
    emoji: formData.get('emoji'),
  })

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const { name, color, emoji } = result.data

  createList(name.trim(), color || '#6366f1', emoji || '📋')

  revalidatePath('/', 'layout')
}

export async function handleToggle(taskId: string) {
  if (!taskId) return
  try {
    toggleTaskComplete(taskId)
  } catch (error) {
    console.error('Failed to toggle task:', error)
    throw new Error('Failed to update task')
  }
  revalidatePath('/', 'layout')
}

export async function handleDelete(taskId: string) {
  if (!taskId) return
  try {
    deleteTask(taskId)
  } catch (error) {
    console.error('Failed to delete task:', error)
    throw new Error('Failed to delete task')
  }
  revalidatePath('/', 'layout')
}

export async function handleDeleteAndRedirect(taskId: string) {
  await handleDelete(taskId)
  redirect('/today')
}

export async function handleClearCompleted() {
  try {
    clearCompletedTasks()
  } catch (error) {
    console.error('Failed to clear completed tasks:', error)
    throw new Error('Failed to clear completed tasks')
  }
  revalidatePath('/', 'layout')
}
