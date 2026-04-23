'use server'

import { revalidatePath } from "next/cache"
import { createTask, createList, createLabel, addTaskLabel, removeTaskLabel, addTaskAttachment, removeTaskAttachment, addTaskReminder, removeTaskReminder, updateTask, toggleTaskComplete, deleteTask } from "@/lib/tasks"
import { redirect } from "next/navigation"

export async function createTaskAction(formData: FormData) {
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const date = formData.get('date') as string
  const listId = formData.get('listId') as string

  if (!name?.trim()) return

  createTask({
    name: name.trim(),
    description: description || null,
    date: date || null,
    list_id: listId || null,
  })

  revalidatePath('/')
  redirect('/today')
}

export async function createListAction(formData: FormData) {
  const name = formData.get('name') as string
  const color = formData.get('color') as string
  const emoji = formData.get('emoji') as string

  if (!name?.trim()) return

  createList(name.trim(), color || '#6366f1', emoji || '📋')
  revalidatePath('/')
}

export async function toggleTaskAction(id: string) {
  toggleTaskComplete(id)
  revalidatePath('/')
}

export async function deleteTaskAction(id: string) {
  deleteTask(id)
  revalidatePath('/')
}
