import {
  getDb,
  queryLists,
  queryLabels,
  insertTask,
  updateTask as updateTaskInDb,
  updateTasks as updateTasksInDb,
  deleteTask as deleteTaskInDb,
  deleteTasks as deleteTasksInDb,
  insertList,
  deleteList as deleteListInDb,
  insertLabel,
  deleteLabel as deleteLabelInDb,
  insertTaskLabel,
  deleteTaskLabel,
  getTaskLabels as getTaskLabelsFromDb,
  insertAttachment,
  deleteAttachment,
  getTaskAttachments as getTaskAttachmentsFromDb,
  insertReminder,
  deleteReminder,
  getTaskReminders as getTaskRemindersFromDb,
  insertLog,
  getTaskLogs as getTaskLogsFromDb,
} from './db'
import type {
  Task,
  List,
  Label,
  TaskAttachment,
  TaskReminder,
  TaskLog,
} from '@/types'
import { generateId } from './utils'

export function getLists(): List[] {
  const db = getDb()
  const lists = queryLists()
  return lists
    .map((l: List) => {
      const listTasks = db.tasks.filter((t: Task) => t.list_id === l.id)
      const taskCount = listTasks.length
      const incompleteCount = listTasks.filter((t: Task) => !t.completed).length
      return { ...l, task_count: taskCount, incomplete_count: incompleteCount }
    })
    .sort((a: List, b: List) => {
      if (a.id === 'inbox') return -1
      if (b.id === 'inbox') return 1
      return a.name.localeCompare(b.name)
    })
}

export function createList(name: string, color: string, emoji: string): List {
  const id = generateId()
  const list = {
    id,
    name,
    color,
    emoji,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  insertList(list)
  return list
}

export function deleteList(id: string): void {
  deleteListInDb(id)
}

export function getLabels(): Label[] {
  return queryLabels().sort((a: Label, b: Label) =>
    a.name.localeCompare(b.name)
  )
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

function getTaskWithRelations(task: Task, db: ReturnType<typeof getDb>): Task {
  const lists = db.lists
  const taskLabels = db.task_labels
  const labels = db.labels
  const taskAttachments = db.task_attachments
  const taskReminders = db.task_reminders
  const allTasks = db.tasks

  return {
    ...task,
    list: task.list_id
      ? lists.find((l: List) => l.id === task.list_id)
      : undefined,
    labels: taskLabels
      .filter(
        (tl: { task_id: string; label_id: string }) => tl.task_id === task.id
      )
      .map((tl: { task_id: string; label_id: string }) =>
        labels.find((l: Label) => l.id === tl.label_id)
      )
      .filter((l: Label | undefined): l is Label => l !== undefined),
    sub_tasks: allTasks
      .filter((t: Task) => t.parent_task_id === task.id)
      .sort((a: Task, b: Task) => (a.position || 0) - (b.position || 0))
      .map((t) => getTaskWithRelations(t, db)),
    attachments: taskAttachments.filter(
      (a: TaskAttachment) => a.task_id === task.id
    ),
    reminders: taskReminders.filter((r: TaskReminder) => r.task_id === task.id),
    logs: db.task_logs
      .filter((l) => l.task_id === task.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }
}

export function getTasks(options?: {
  listId?: string
  labelId?: string
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  completed?: boolean
  search?: string
}): Task[] {
  const db = getDb()
  let tasks = (db.tasks || []).filter((t) => !t.parent_task_id)

  if (options?.listId) {
    tasks = tasks.filter((t) => t.list_id === options.listId)
  }

  if (options?.labelId) {
    const taskIdsWithLabel = new Set(
      db.task_labels
        .filter((tl) => tl.label_id === options.labelId)
        .map((tl) => tl.task_id)
    )
    tasks = tasks.filter((t) => taskIdsWithLabel.has(t.id))
  }

  if (options?.view) {
    const today = new Date().toISOString().split('T')[0]
    const next7 = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split('T')[0]

    switch (options.view) {
      case 'today':
        tasks = tasks.filter((t) => t.date === today || t.deadline === today)
        break
      case 'next7':
        tasks = tasks.filter(
          (t) => t.date && t.date >= today && t.date <= next7
        )
        break
      case 'upcoming':
        tasks = tasks.filter((t) => t.date && t.date >= today)
        break
    }
  }

  if (options?.completed !== undefined) {
    tasks = tasks.filter((t) => t.completed === options.completed)
  }

  if (options?.search) {
    const search = options.search.toLowerCase()
    tasks = tasks.filter(
      (t) =>
        t.name.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
    )
  }

  return tasks
    .sort((a: Task, b: Task) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      const priorityOrder: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
        none: 3,
      }
      if (a.priority !== b.priority)
        return (
          (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0)
        )
      return (a.position || 0) - (b.position || 0)
    })
    .map((t) => getTaskWithRelations(t, db))
}

export function getTask(id: string): Task | undefined {
  const db = getDb()
  const task = db.tasks.find((t: Task) => t.id === id)
  if (!task) return undefined

  return getTaskWithRelations(task, db)
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
    completed: data.completed || false,
    completed_at: null,
    position: data.position || 0,
    created_at: now,
    updated_at: now,
  }
  insertTask(task)
  logTaskAction(id, 'created', `Task "${data.name}" created`)
  return getTask(id) ?? task
}

export function updateTask(id: string, data: Partial<Task>): void {
  const oldTask = getTask(id)
  updateTaskInDb(id, data)

  if (oldTask) {
    const changes = Object.keys(data).filter(
      (k) => data[k as keyof Task] !== oldTask[k as keyof Task]
    )
    if (changes.length > 0) {
      logTaskAction(id, 'updated', `Updated: ${changes.join(', ')}`)
    }
  }
}

function collectSubTaskIds(subTasks: Task[]): string[] {
  const ids: string[] = []
  for (const sub of subTasks) {
    ids.push(sub.id)
    if (sub.sub_tasks) {
      ids.push(...collectSubTaskIds(sub.sub_tasks))
    }
  }
  return ids
}

export function toggleTaskComplete(id: string): void {
  const task = getTask(id)
  if (!task) return

  const completed = !task.completed
  const completedAt = completed ? new Date().toISOString() : null

  const subIds = task.sub_tasks ? collectSubTaskIds(task.sub_tasks) : []
  const allIds = [id, ...subIds]

  updateTasksInDb(
    allIds.map((tid) => ({
      id: tid,
      data: { completed, completed_at: completedAt },
    }))
  )

  logTaskAction(
    id,
    completed ? 'completed' : 'reopened',
    `Task ${completed ? 'completed' : 'reopened'}`
  )
}

export function deleteTask(id: string): void {
  deleteTaskInDb(id)
}

export function clearCompletedTasks(): void {
  const db = getDb()
  const completedTaskIds = db.tasks
    .filter((t: Task) => t.completed)
    .map((t: Task) => t.id)

  if (completedTaskIds.length === 0) return
  deleteTasksInDb(completedTaskIds)
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

export function addTaskAttachment(
  taskId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  mimeType?: string
): void {
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
  const att = db.task_attachments.find(
    (a: TaskAttachment) => a.id === attachmentId
  )
  if (att) {
    deleteAttachment(attachmentId)
    logTaskAction(
      att.task_id,
      'attachment_removed',
      `File "${att.file_name}" removed`
    )
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
    sent: false,
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
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  return db.tasks
    .filter(
      (t: Task) =>
        t.date !== null && t.date < today && !t.completed && !t.parent_task_id
    )
    .sort((a: Task, b: Task) => {
      if (!a.date || !b.date) return 0
      return a.date.localeCompare(b.date)
    })
    .map((t) => getTaskWithRelations(t, db))
}

export function searchTasks(query: string): Task[] {
  const db = getDb()
  return db.tasks
    .filter(
      (t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        (t.description !== null &&
          t.description.toLowerCase().includes(query.toLowerCase()))
    )
    .sort((a: Task, b: Task) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50)
    .map((t) => getTaskWithRelations(t, db))
}
