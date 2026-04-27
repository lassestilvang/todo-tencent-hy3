import { getDb, queryTasks, insertTask, updateTask as updateTaskInDb, deleteTask as deleteTaskInDb,
  insertList, updateList as updateListInDb, deleteList as deleteListInDb,
  insertLabel, deleteLabel as deleteLabelInDb,
  insertTaskLabel, deleteTaskLabel, getTaskLabels as getTaskLabelsFromDb,
  insertAttachment, deleteAttachment, getTaskAttachments as getTaskAttachmentsFromDb,
  insertReminder, deleteReminder, getTaskReminders as getTaskRemindersFromDb,
  insertLog, getTaskLogs as getTaskLogsFromDb,
} from './db'
import type { Task, List, Label, TaskAttachment, TaskReminder, TaskLog } from '@/types'
import { generateId } from './utils'

export function getLists(): List[] {
  const db = getDb()
  const lists = db.lists;

  return lists.map((l: List) => {
    const taskCount = queryTasks(t => t.list_id === l.id).length
    const incompleteCount = queryTasks(t => t.list_id === l.id && !t.completed).length
    return { ...l, task_count: taskCount, incomplete_count: incompleteCount }
  }).sort((a: List, b: List) => {
    if (a.id === 'inbox') return -1
    if (b.id === 'inbox') return 1
    return a.name.localeCompare(b.name)
  })
}

export function createList(name: string, color: string, emoji: string): List {
  const id = generateId()
  const list = { id, name, color, emoji, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  insertList(list)
  return list
}

export function updateList(id: string, data: Partial<Omit<List, 'id' | 'created_at' | 'updated_at'>>): void {
  updateListInDb(id, { ...data, updated_at: new Date().toISOString() })
}

export function deleteList(id: string): void {
  deleteListInDb(id)
}

export function getLabels(): Label[] {
  const db = getDb()
  return db.labels.sort((a: Label, b: Label) => a.name.localeCompare(b.name))
}

export function createLabel(name: string, color: string, icon: string): Label {
  const id = generateId()
  const label = { id, name, color, icon, created_at: new Date().toISOString() }
  insertLabel(label)
  return label
}

export function deleteLabel(id: string): void {
  deleteLabelInDb(id)
}

function getTaskWithRelations(task: any): Task {
  return {
    ...task,
    list: task.list_id ? getDb().lists.find((l: any) => l.id === task.list_id) : undefined,
    labels: getTaskLabels(task.id),
    sub_tasks: getSubTasks(task.id),
    attachments: getTaskAttachments(task.id),
    reminders: getTaskReminders(task.id),
  }
}

export function getTasks(options?: {
  listId?: string
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  completed?: boolean
  search?: string
}): Task[] {
  let tasks = queryTasks(t => !t.parent_task_id)

  if (options?.listId) {
    tasks = tasks.filter(t => t.list_id === options.listId)
  }

  if (options?.view) {
    const today = new Date().toISOString().split('T')[0]
    const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    switch (options.view) {
      case 'today':
        tasks = tasks.filter(t => t.date === today || t.deadline === today)
        break
      case 'next7':
        tasks = tasks.filter(t => t.date && t.date >= today && t.date <= next7)
        break
      case 'upcoming':
        tasks = tasks.filter(t => t.date >= today || t.date === null)
        break
    }
  }

  if (options?.completed !== undefined) {
    tasks = tasks.filter(t => t.completed === (options.completed ? 1 : 0))
  }

  if (options?.search) {
    const search = options.search.toLowerCase()
    tasks = tasks.filter(t =>
      t.name.toLowerCase().includes(search) ||
      (t.description && t.description.toLowerCase().includes(search))
    )
  }

  return tasks
    .sort((a: any, b: any) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 }
      if (a.priority !== b.priority) return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0)
      return (a.position || 0) - (b.position || 0)
    })
    .map(getTaskWithRelations)
}

export function getTask(id: string): Task | undefined {
  const task = queryTasks(t => t.id === id)[0]
  if (!task) return undefined;

  return getTaskWithRelations(task)
}

export function createTask(data: Partial<Task>): Task {
  const id = generateId()
  const now = new Date().toISOString()
  const task = {
    id,
    name: data.name || '',
    description: data.description || null,
    date: data.date || null,
    deadline: data.deadline || null,
    estimate: data.estimate || null,
    actual_time: data.actual_time || 0,
    priority: data.priority || 'none',
    recurring: data.recurring || null,
    list_id: data.list_id || null,
    parent_task_id: data.parent_task_id || null,
    completed: data.completed || 0,
    completed_at: null,
    position: data.position || 0,
    created_at: now,
    updated_at: now,
  }
  insertTask(task)
  logTaskAction(id, 'created', `Task "${data.name}" created`)
  return getTask(id)!
}

export function updateTask(id: string, data: Partial<Task>): void {
  const oldTask = getTask(id)
  updateTaskInDb(id, { ...data, updated_at: new Date().toISOString() })

  if (oldTask) {
    const changes = Object.keys(data).filter(k => data[k as keyof Task] !== oldTask[k as keyof Task])
    if (changes.length > 0) {
      logTaskAction(id, 'updated', `Updated: ${changes.join(', ')}`)
    }
  }
}

export function toggleTaskComplete(id: string): void {
  const task = getTask(id)
  if (!task) return;

  const completed = task.completed ? 0 : 1
  const completedAt = completed ? new Date().toISOString() : null
  updateTaskInDb(id, { completed, completed_at: completedAt })

  logTaskAction(id, completed ? 'completed' : 'reopened', `Task ${completed ? 'completed' : 'reopened'}`)

  if (task.sub_tasks) {
    for (const sub of task.sub_tasks) {
      toggleTaskComplete(sub.id)
    }
  }
}

export function deleteTask(id: string): void {
  deleteTaskInDb(id)
}

function getSubTasks(parentId: string): Task[] {
  return queryTasks(t => t.parent_task_id === parentId)
    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
    .map(getTaskWithRelations)
}

export function getTaskLabels(taskId: string): Label[] {
  return getTaskLabelsFromDb(taskId)
}

export function addTaskLabel(taskId: string, labelId: string): void {
  insertTaskLabel(taskId, labelId)
  logTaskAction(taskId, 'label_added', `Label ${labelId} added`)
}

export function removeTaskLabel(taskId: string, labelId: string): void {
  deleteTaskLabel(taskId, labelId)
  logTaskAction(taskId, 'label_removed', `Label ${labelId} removed`)
}

export function getTaskAttachments(taskId: string): TaskAttachment[] {
  return getTaskAttachmentsFromDb(taskId)
}

export function addTaskAttachment(taskId: string, fileName: string, filePath: string, fileSize: number, mimeType?: string): void {
  const id = generateId()
  insertAttachment({
    id,
    task_id: taskId,
    file_name: fileName,
    file_path: filePath,
    file_size: fileSize,
    mime_type: mimeType || null,
    created_at: new Date().toISOString(),
  })
  logTaskAction(taskId, 'attachment_added', `File "${fileName}" attached`)
}

export function removeTaskAttachment(attachmentId: string): void {
  const db = getDb()
  const att = db.task_attachments.find((a: any) => a.id === attachmentId)
  if (att) {
    deleteAttachment(attachmentId)
    logTaskAction(att.task_id, 'attachment_removed', `File "${att.file_name}" removed`)
  }
}

export function getTaskReminders(taskId: string): TaskReminder[] {
  return getTaskRemindersFromDb(taskId)
}

export function addTaskReminder(taskId: string, reminderTime: string): void {
  const id = generateId()
  insertReminder({
    id,
    task_id: taskId,
    reminder_time: reminderTime,
    sent: 0,
    created_at: new Date().toISOString(),
  })
  logTaskAction(taskId, 'reminder_added', `Reminder set for ${reminderTime}`)
}

export function removeTaskReminder(reminderId: string): void {
  deleteReminder(reminderId)
}

export function getTaskLogs(taskId: string): TaskLog[] {
  return getTaskLogsFromDb(taskId)
}

function logTaskAction(taskId: string, action: string, details: string): void {
  const id = generateId()
  insertLog({
    id,
    task_id: taskId,
    action,
    details,
    created_at: new Date().toISOString(),
  })
}

export function getOverdueTasks(): Task[] {
  const today = new Date().toISOString().split('T')[0]
  return queryTasks(t => t.date < today && !t.completed && !t.parent_task_id)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map(getTaskWithRelations)
}

export function searchTasks(query: string): Task[] {
  return queryTasks(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(query.toLowerCase()))
  )
    .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50)
    .map(getTaskWithRelations)
}
