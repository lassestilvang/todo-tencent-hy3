import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.TEST_DB_PATH || path.join(__dirname, '../../tasks.json')

interface Database {
  lists: any[]
  labels: any[]
  tasks: any[]
  task_labels: any[]
  task_attachments: any[]
  task_reminders: any[]
  task_logs: any[]
}

function loadDb(): Database {
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath, 'utf-8')
    return JSON.parse(data)
  }
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

function saveDb(db: Database) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
}

export function getDb(): Database {
  return loadDb()
}

export function queryTasks(where?: (task: any) => boolean): any[] {
  const db = loadDb()
  let tasks = db.tasks
  if (where) {
    tasks = tasks.filter(where)
  }
  return tasks
}

export function insertTask(task: any) {
  const db = loadDb()
  db.tasks.push(task)
  saveDb(db)
}

export function updateTask(id: string, data: any) {
  const db = loadDb()
  const index = db.tasks.findIndex((t: any) => t.id === id)
  if (index !== -1) {
    db.tasks[index] = { ...db.tasks[index], ...data, updated_at: new Date().toISOString() }
    saveDb(db)
  }
}

export function deleteTask(id: string) {
  const db = loadDb()
  db.tasks = db.tasks.filter((t: any) => t.id !== id && t.parent_task_id !== id)
  saveDb(db)
}

export function queryLists(): any[] {
  const db = loadDb()
  return db.lists
}

export function insertList(list: any) {
  const db = loadDb()
  db.lists.push(list)
  saveDb(db)
}

export function updateList(id: string, data: any) {
  const db = loadDb()
  const index = db.lists.findIndex((l: any) => l.id === id)
  if (index !== -1) {
    db.lists[index] = { ...db.lists[index], ...data, updated_at: new Date().toISOString() }
    saveDb(db)
  }
}

export function deleteList(id: string) {
  const db = loadDb()
  db.lists = db.lists.filter((l: any) => l.id !== id)
  saveDb(db)
}

export function queryLabels(): any[] {
  const db = loadDb()
  return db.labels
}

export function insertLabel(label: any) {
  const db = loadDb()
  db.labels.push(label)
  saveDb(db)
}

export function deleteLabel(id: string) {
  const db = loadDb()
  db.labels = db.labels.filter((l: any) => l.id !== id)
  saveDb(db)
}

export function insertTaskLabel(taskId: string, labelId: string) {
  const db = loadDb()
  if (!db.task_labels.find((tl: any) => tl.task_id === taskId && tl.label_id === labelId)) {
    db.task_labels.push({ task_id: taskId, label_id: labelId })
    saveDb(db)
  }
}

export function deleteTaskLabel(taskId: string, labelId: string) {
  const db = loadDb()
  db.task_labels = db.task_labels.filter((tl: any) => !(tl.task_id === taskId && tl.label_id === labelId))
  saveDb(db)
}

export function getTaskLabels(taskId: string): any[] {
  const db = loadDb()
  const labelIds = db.task_labels.filter((tl: any) => tl.task_id === taskId).map((tl: any) => tl.label_id)
  return db.labels.filter((l: any) => labelIds.includes(l.id))
}

export function insertAttachment(att: any) {
  const db = loadDb()
  db.task_attachments.push(att)
  saveDb(db)
}

export function deleteAttachment(id: string) {
  const db = loadDb()
  db.task_attachments = db.task_attachments.filter((a: any) => a.id !== id)
  saveDb(db)
}

export function getTaskAttachments(taskId: string): any[] {
  const db = loadDb()
  return db.task_attachments.filter((a: any) => a.task_id === taskId)
}

export function insertReminder(rem: any) {
  const db = loadDb()
  db.task_reminders.push(rem)
  saveDb(db)
}

export function deleteReminder(id: string) {
  const db = loadDb()
  db.task_reminders = db.task_reminders.filter((r: any) => r.id !== id)
  saveDb(db)
}

export function getTaskReminders(taskId: string): any[] {
  const db = loadDb()
  return db.task_reminders.filter((r: any) => r.task_id === taskId)
}

export function insertLog(log: any) {
  const db = loadDb()
  db.task_logs.push(log)
  saveDb(db)
}

export function getTaskLogs(taskId: string): any[] {
  const db = loadDb()
  return db.task_logs.filter((l: any) => l.task_id === taskId).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
}


export function closeDb() {
  if (db) {
    saveDb(db)
    db = null
  }
}

export function resetDb() {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  } catch(e) {}
  // Force reload on next getDb() call
  db = null
}
