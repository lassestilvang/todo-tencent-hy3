import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { List, Label, Task, TaskLabel, TaskAttachment, TaskReminder, TaskLog } from '@/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.TEST_DB_PATH || path.join(/*turbopackIgnore: true*/ process.cwd(), 'tasks.json')

interface Database {
  lists: List[]
  labels: Label[]
  tasks: Task[]
  task_labels: TaskLabel[]
  task_attachments: TaskAttachment[]
  task_reminders: TaskReminder[]
  task_logs: TaskLog[]
}

export function getDb(): Database {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      console.error('Failed to parse database file:', e)
      // Return default database on parse error
    }
  }
  // Return default database
  return {
    lists: [{ id: 'inbox', name: 'Inbox', color: '#6366f1', emoji: '📥', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    labels: [],
    tasks: [],
    task_labels: [],
    task_attachments: [],
    task_reminders: [],
    task_logs: []
  }
}

export function saveDb(db: Database) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
  } catch (e) {
    console.error('Failed to save database:', e)
    throw e
  }
}

export function resetDb() {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  } catch(e) {
    console.error('Failed to reset database:', e)
  }
}

// Helper functions for tasks
export function queryTasks(where?: (task: Task) => boolean): Task[] {
  const db = getDb()
  let tasks = db.tasks || []
  if (where) {
    tasks = tasks.filter(where)
  }
  return tasks
}

export function insertTask(task: Task) {
  const db = getDb()
  db.tasks.push(task)
  saveDb(db)
}

export function updateTask(id: string, data: Partial<Task>) {
  const db = getDb()
  const index = db.tasks.findIndex((t: Task) => t.id === id)
  if (index !== -1) {
    db.tasks[index] = { ...db.tasks[index], ...data, updated_at: new Date().toISOString() }
    saveDb(db)
  }
}

export function deleteTask(id: string) {
  const db = getDb()
  db.tasks = db.tasks.filter((t: Task) => t.id !== id && t.parent_task_id !== id)
  saveDb(db)
}

// Helper functions for lists
export function queryLists(): List[] {
  const db = getDb()
  return db.lists || []
}

export function insertList(list: List) {
  const db = getDb()
  db.lists.push(list)
  saveDb(db)
}

export function updateList(id: string, data: Partial<List>) {
  const db = getDb()
  const index = db.lists.findIndex((l: List) => l.id === id)
  if (index !== -1) {
    db.lists[index] = { ...db.lists[index], ...data, updated_at: new Date().toISOString() }
    saveDb(db)
  }
}

export function deleteList(id: string) {
  const db = getDb()
  db.lists = db.lists.filter((l: List) => l.id !== id)
  saveDb(db)
}

// Helper functions for labels
export function queryLabels(): Label[] {
  const db = getDb()
  return db.labels || []
}

export function insertLabel(label: Label) {
  const db = getDb()
  db.labels.push(label)
  saveDb(db)
}

export function deleteLabel(id: string) {
  const db = getDb()
  db.labels = db.labels.filter((l: Label) => l.id !== id)
  saveDb(db)
}

// Task labels
export function insertTaskLabel(taskId: string, labelId: string) {
  const db = getDb()
  if (!db.task_labels.find((tl: TaskLabel) => tl.task_id === taskId && tl.label_id === labelId)) {
    db.task_labels.push({ task_id: taskId, label_id: labelId })
    saveDb(db)
  }
}

export function deleteTaskLabel(taskId: string, labelId: string) {
  const db = getDb()
  db.task_labels = db.task_labels.filter((tl: TaskLabel) => !(tl.task_id === taskId && tl.label_id === labelId))
  saveDb(db)
}

export function getTaskLabels(taskId: string): Label[] {
  const db = getDb()
  const labelIds = db.task_labels
    .filter((tl: TaskLabel) => tl.task_id === taskId)
    .map((tl: TaskLabel) => tl.label_id)
  return db.labels.filter((l: Label) => labelIds.includes(l.id))
}

// Attachments
export function insertAttachment(att: TaskAttachment) {
  const db = getDb()
  db.task_attachments.push(att)
  saveDb(db)
}

export function deleteAttachment(id: string) {
  const db = getDb()
  db.task_attachments = db.task_attachments.filter((a: TaskAttachment) => a.id !== id)
  saveDb(db)
}

export function getTaskAttachments(taskId: string): TaskAttachment[] {
  const db = getDb()
  return db.task_attachments.filter((a: TaskAttachment) => a.task_id === taskId)
}

// Reminders
export function insertReminder(rem: TaskReminder) {
  const db = getDb()
  db.task_reminders.push(rem)
  saveDb(db)
}

export function deleteReminder(id: string) {
  const db = getDb()
  db.task_reminders = db.task_reminders.filter((r: TaskReminder) => r.id !== id)
  saveDb(db)
}

export function getTaskReminders(taskId: string): TaskReminder[] {
  const db = getDb()
  return db.task_reminders.filter((r: TaskReminder) => r.task_id === taskId)
}

// Logs
export function insertLog(log: TaskLog) {
  const db = getDb()
  db.task_logs.push(log)
  saveDb(db)
}

export function getTaskLogs(taskId: string): TaskLog[] {
  const db = getDb()
  return db.task_logs
    .filter((l: TaskLog) => l.task_id === taskId)
    .sort((a: TaskLog, b: TaskLog) => b.created_at.localeCompare(a.created_at))
}
