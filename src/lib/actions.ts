'use server'

import { createTask, createList, toggleTaskComplete, deleteTask } from '@/lib/tasks'
import type { Priority } from '@/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const validPriorities: Priority[] = ['high', 'medium', 'low', 'none']

export async function createTaskAction(formData: FormData) {
  const name = formData.get('name') as string
  if (!name || name.trim() === '') {
    throw new Error('Task name is required')
  }
  const description = formData.get('description') as string
  const date = formData.get('date') as string
  const priority = formData.get('priority') as Priority
  const listId = formData.get('listId') as string

  createTask({
    name: name.trim(),
    description: description || undefined,
    date: date || undefined,
    priority: validPriorities.includes(priority) ? priority : 'none',
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
