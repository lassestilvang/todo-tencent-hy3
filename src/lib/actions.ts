'use server'

import { createTask, createList, toggleTaskComplete, deleteTask } from '@/lib/tasks'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createTaskAction(formData: FormData) {
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const date = formData.get('date') as string
  const priority = formData.get('priority') as string
  const listId = formData.get('listId') as string

  createTask({
    name,
    description: description || undefined,
    date: date || undefined,
    priority: priority as any || 'none',
    list_id: listId || undefined,
  })

  revalidatePath('/')
}

export async function createListAction(formData: FormData) {
  const name = formData.get('name') as string
  const color = formData.get('color') as string
  const emoji = formData.get('emoji') as string

  createList(name, color || '#6366f1', emoji || '📋')

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
