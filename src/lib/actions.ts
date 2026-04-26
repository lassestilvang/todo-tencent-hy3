'use server'

import { toggleTaskComplete, deleteTask } from '@/lib/tasks'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function handleToggle(taskId: string) {
  toggleTaskComplete(taskId)
  revalidatePath('/')
}

export async function handleDelete(taskId: string) {
  deleteTask(taskId)
  redirect('/')
}
