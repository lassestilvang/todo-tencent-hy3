import fs from 'fs'
import path from 'path'
import { cache } from 'react'
import type {
  List,
  Label,
  Task,
  TaskAttachment,
  TaskReminder,
  TaskLog,
} from '@/types'
import { env } from './env'
import { z } from 'zod'

// Zod schemas for input validation and legacy data migration
const PrioritySchema = z.enum(['high', 'medium', 'low', 'none'])
const RecurringTypeSchema = z
  .enum([
    'every_day',
    'every_week',
    'every_weekday',
    'every_month',
    'every_year',
    'custom',
  ])
  .nullable()

const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()

const ListSchema = z.object({
  id: z.string().min(1, 'List ID is required'),
  name: z.string().min(1, 'List name is required'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color format'),
  emoji: z.string().min(1, 'Emoji is required'),
  created_at: z.string().datetime('Invalid created_at datetime'),
  updated_at: z.string().datetime('Invalid updated_at datetime'),
})

const LabelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1),
  created_at: z.string().datetime(),
})

const TaskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  date: DateStringSchema,
  deadline: DateStringSchema,
  estimate: z.number().int().positive().nullable(),
  actual_time: z.number().int().nonnegative(),
  priority: PrioritySchema,
  recurring: RecurringTypeSchema,
  list_id: z.string().nullable(),
  parent_task_id: z.string().nullable(),
  completed: z
    .boolean()
    .or(z.number().int().min(0).max(1))
    .transform((val) => !!val),
  completed_at: z.string().datetime().nullable(),
  position: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

const TaskLabelSchema = z.object({
  task_id: z.string().min(1),
  label_id: z.string().min(1),
})

const TaskAttachmentSchema = z.object({
  id: z.string().min(1),
  task_id: z.string().min(1),
  file_name: z.string().min(1),
  file_path: z.string().min(1),
  file_size: z.number().int().positive(),
  mime_type: z.string().nullable(),
  created_at: z.string().datetime(),
})

const TaskReminderSchema = z.object({
  id: z.string().min(1),
  task_id: z.string().min(1),
  reminder_time: z.string().datetime(),
  sent: z
    .boolean()
    .or(z.number().int().min(0).max(1))
    .transform((val) => !!val),
  created_at: z.string().datetime(),
})

const TaskLogSchema = z.object({
  id: z.string().min(1),
  task_id: z.string().min(1),
  action: z.string().min(1),
  details: z.string().nullable(),
  created_at: z.string().datetime(),
})

const DatabaseSchema = z.object({
  lists: z.array(ListSchema),
  labels: z.array(LabelSchema),
  tasks: z.array(TaskSchema),
  task_labels: z.array(TaskLabelSchema),
  task_attachments: z.array(TaskAttachmentSchema),
  task_reminders: z.array(TaskReminderSchema),
  task_logs: z.array(TaskLogSchema),
})

// Database path configuration
const dbPath =
  env.TEST_DB_PATH ||
  path.join(/*turbopackIgnore: true*/ process.cwd(), 'tasks.json')

// Default database structure for new or corrupted databases
function createDefaultDb(): z.infer<typeof DatabaseSchema> {
  const now = new Date().toISOString()
  return {
    lists: [
      {
        id: 'inbox',
        name: 'Inbox',
        color: '#6366f1',
        emoji: '📥',
        created_at: now,
        updated_at: now,
      },
    ],
    labels: [],
    tasks: [],
    task_labels: [],
    task_attachments: [],
    task_reminders: [],
    task_logs: [],
  }
}

/**
 * Read and validate the database from disk
 * Handles corrupted files by backing them up and returning a default database
 * Uses React cache to deduplicate reads within the same render pass
 */
export const getDb: () => z.infer<typeof DatabaseSchema> = cache(() => {
  if (!fs.existsSync(dbPath)) {
    return createDefaultDb()
  }

  try {
    const rawData = fs.readFileSync(dbPath, 'utf-8')
    const parsedData = JSON.parse(rawData)

    const validationResult = DatabaseSchema.safeParse(parsedData)
    if (!validationResult.success) {
      console.error(
        'Database validation failed:',
        validationResult.error.format()
      )
      backupCorruptedDb()
      return createDefaultDb()
    }

    return validationResult.data
  } catch (error) {
    console.error('Failed to read database file:', error)
    if (fs.existsSync(dbPath)) {
      backupCorruptedDb()
    }
    return createDefaultDb()
  }
})

/**
 * Save validated database to disk
 * Creates backup of existing database before overwriting
 */
export function saveDb(db: z.infer<typeof DatabaseSchema>): void {
  try {
    // Validate database structure before saving
    const validationResult = DatabaseSchema.safeParse(db)
    if (!validationResult.success) {
      throw new Error(
        `Invalid database structure: ${JSON.stringify(validationResult.error.format())}`
      )
    }

    // Ensure target directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Backup existing database before overwriting
    if (fs.existsSync(dbPath)) {
      const backupPath = `${dbPath}.backup.${Date.now()}`
      fs.copyFileSync(dbPath, backupPath)
    }

    // Write validated database to disk
    fs.writeFileSync(dbPath, JSON.stringify(validationResult.data, null, 2))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to save database:', message)
    throw new Error(`Database save failed: ${message}`)
  }
}

/**
 * Reset database by deleting the database file (creates backup first)
 */
export function resetDb(): void {
  try {
    if (fs.existsSync(dbPath)) {
      const backupPath = `${dbPath}.backup.${Date.now()}`
      fs.copyFileSync(dbPath, backupPath)
      fs.unlinkSync(dbPath)
      console.log(`Database reset. Backup saved to ${backupPath}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to reset database:', message)
    throw new Error(`Database reset failed: ${message}`)
  }
}

// Helper function to backup corrupted database files
function backupCorruptedDb(): void {
  if (!fs.existsSync(dbPath)) return
  const backupPath = `${dbPath}.corrupted.${Date.now()}`
  fs.copyFileSync(dbPath, backupPath)
  console.error(`Corrupted database backed up to ${backupPath}`)
}

// ---- Task Operations ----
export function insertTask(task: Task): void {
  const validation = TaskSchema.safeParse(task)
  if (!validation.success) {
    throw new Error(
      `Invalid task data: ${JSON.stringify(validation.error.format())}`
    )
  }

  const db = getDb()
  db.tasks.push(validation.data)
  saveDb(db)
}

export function updateTask(id: string, data: Partial<Task>): void {
  if (!id) throw new Error('Task ID is required for update')

  const db = getDb()
  const index = db.tasks.findIndex((t) => t.id === id)
  if (index === -1) {
    console.warn(`Task with ID ${id} not found for update`)
    return
  }

  const updatedTask = {
    ...db.tasks[index],
    ...data,
    updated_at: new Date().toISOString(),
  }
  const validation = TaskSchema.safeParse(updatedTask)
  if (!validation.success) {
    throw new Error(
      `Invalid updated task data: ${JSON.stringify(validation.error.format())}`
    )
  }

  db.tasks[index] = validation.data
  saveDb(db)
}

export function updateTasks(
  updates: { id: string; data: Partial<Task> }[]
): void {
  if (updates.length === 0) return

  const db = getDb()
  const now = new Date().toISOString()

  for (const { id, data } of updates) {
    const index = db.tasks.findIndex((t) => t.id === id)
    if (index === -1) {
      console.warn(`Task with ID ${id} not found for batch update`)
      continue
    }
    const updated = { ...db.tasks[index], ...data, updated_at: now }
    const validation = TaskSchema.safeParse(updated)
    if (!validation.success) {
      console.warn(`Invalid batch update for task ${id}: skipping`)
      continue
    }
    db.tasks[index] = validation.data
  }

  saveDb(db)
}

export function deleteTask(id: string): void {
  if (!id) throw new Error('Task ID is required for deletion')

  const db = getDb()
  const allIds = new Set([
    id,
    ...db.tasks
      .filter((t: Task) => t.parent_task_id === id)
      .map((t: Task) => t.id),
  ])
  const initialLength = db.tasks.length
  db.tasks = db.tasks.filter(
    (t: Task) => t.id !== id && t.parent_task_id !== id
  )

  if (db.tasks.length === initialLength) {
    console.warn(`Task with ID ${id} not found for deletion`)
  } else {
    db.task_labels = db.task_labels.filter((tl) => !allIds.has(tl.task_id))
    db.task_attachments = db.task_attachments.filter(
      (a) => !allIds.has(a.task_id)
    )
    db.task_reminders = db.task_reminders.filter((r) => !allIds.has(r.task_id))
    db.task_logs = db.task_logs.filter((l) => !allIds.has(l.task_id))
  }

  saveDb(db)
}

export function deleteTasks(ids: string[]): void {
  if (ids.length === 0) return

  const idSet = new Set(ids)
  const db = getDb()
  db.tasks = db.tasks.filter(
    (t) =>
      !idSet.has(t.id) &&
      (t.parent_task_id === null || !idSet.has(t.parent_task_id))
  )
  db.task_labels = db.task_labels.filter((tl) => !idSet.has(tl.task_id))
  db.task_attachments = db.task_attachments.filter((a) => !idSet.has(a.task_id))
  db.task_reminders = db.task_reminders.filter((r) => !idSet.has(r.task_id))
  db.task_logs = db.task_logs.filter((l) => !idSet.has(l.task_id))
  saveDb(db)
}

// ---- List Operations ----
export function queryLists(): List[] {
  return getDb().lists
}

export function insertList(list: List): void {
  const validation = ListSchema.safeParse(list)
  if (!validation.success) {
    throw new Error(
      `Invalid list data: ${JSON.stringify(validation.error.format())}`
    )
  }

  const db = getDb()
  db.lists.push(validation.data)
  saveDb(db)
}

export function updateList(id: string, data: Partial<List>): void {
  if (!id) throw new Error('List ID is required for update')

  const db = getDb()
  const index = db.lists.findIndex((l) => l.id === id)
  if (index === -1) {
    console.warn(`List with ID ${id} not found for update`)
    return
  }

  const updatedList = {
    ...db.lists[index],
    ...data,
    updated_at: new Date().toISOString(),
  }
  const validation = ListSchema.safeParse(updatedList)
  if (!validation.success) {
    throw new Error(
      `Invalid updated list data: ${JSON.stringify(validation.error.format())}`
    )
  }

  db.lists[index] = validation.data
  saveDb(db)
}

export function deleteList(id: string): void {
  if (!id) throw new Error('List ID is required for deletion')

  const db = getDb()
  const initialLength = db.lists.length
  db.lists = db.lists.filter((l) => l.id !== id)

  if (db.lists.length === initialLength) {
    console.warn(`List with ID ${id} not found for deletion`)
  }

  saveDb(db)
}

// ---- Label Operations ----
export function queryLabels(): Label[] {
  return getDb().labels
}

export function insertLabel(label: Label): void {
  const validation = LabelSchema.safeParse(label)
  if (!validation.success) {
    throw new Error(
      `Invalid label data: ${JSON.stringify(validation.error.format())}`
    )
  }

  const db = getDb()
  db.labels.push(validation.data)
  saveDb(db)
}

export function deleteLabel(id: string): void {
  if (!id) throw new Error('Label ID is required for deletion')

  const db = getDb()
  const initialLength = db.labels.length
  db.labels = db.labels.filter((l) => l.id !== id)

  if (db.labels.length === initialLength) {
    console.warn(`Label with ID ${id} not found for deletion`)
  }

  saveDb(db)
}

// ---- Task Label Operations ----
export function insertTaskLabel(taskId: string, labelId: string): void {
  if (!taskId || !labelId) {
    throw new Error('Task ID and Label ID are required')
  }

  const db = getDb()
  const exists = db.task_labels.find(
    (tl) => tl.task_id === taskId && tl.label_id === labelId
  )

  if (!exists) {
    const validation = TaskLabelSchema.safeParse({
      task_id: taskId,
      label_id: labelId,
    })
    if (!validation.success) {
      throw new Error(
        `Invalid task label data: ${JSON.stringify(validation.error.format())}`
      )
    }
    db.task_labels.push(validation.data)
    saveDb(db)
  }
}

export function deleteTaskLabel(taskId: string, labelId: string): void {
  if (!taskId || !labelId) {
    throw new Error('Task ID and Label ID are required')
  }

  const db = getDb()
  const initialLength = db.task_labels.length
  db.task_labels = db.task_labels.filter(
    (tl) => !(tl.task_id === taskId && tl.label_id === labelId)
  )

  if (db.task_labels.length === initialLength) {
    console.warn(
      `Task label association not found for task ${taskId} and label ${labelId}`
    )
  }

  saveDb(db)
}

export function getTaskLabels(taskId: string): Label[] {
  const db = getDb()
  const labelIds = db.task_labels
    .filter((tl) => tl.task_id === taskId)
    .map((tl) => tl.label_id)
  return db.labels.filter((l) => labelIds.includes(l.id))
}

// ---- Attachment Operations ----
export function insertAttachment(att: TaskAttachment): void {
  const validation = TaskAttachmentSchema.safeParse(att)
  if (!validation.success) {
    throw new Error(
      `Invalid attachment data: ${JSON.stringify(validation.error.format())}`
    )
  }

  const db = getDb()
  db.task_attachments.push(validation.data)
  saveDb(db)
}

export function deleteAttachment(id: string): void {
  if (!id) throw new Error('Attachment ID is required for deletion')

  const db = getDb()
  const initialLength = db.task_attachments.length
  db.task_attachments = db.task_attachments.filter((a) => a.id !== id)

  if (db.task_attachments.length === initialLength) {
    console.warn(`Attachment with ID ${id} not found for deletion`)
  }

  saveDb(db)
}

export function getTaskAttachments(taskId: string): TaskAttachment[] {
  return getDb().task_attachments.filter((a) => a.task_id === taskId)
}

// ---- Reminder Operations ----
export function insertReminder(rem: TaskReminder): void {
  const validation = TaskReminderSchema.safeParse(rem)
  if (!validation.success) {
    throw new Error(
      `Invalid reminder data: ${JSON.stringify(validation.error.format())}`
    )
  }

  const db = getDb()
  db.task_reminders.push(validation.data)
  saveDb(db)
}

export function deleteReminder(id: string): void {
  if (!id) throw new Error('Reminder ID is required for deletion')

  const db = getDb()
  const initialLength = db.task_reminders.length
  db.task_reminders = db.task_reminders.filter((r) => r.id !== id)

  if (db.task_reminders.length === initialLength) {
    console.warn(`Reminder with ID ${id} not found for deletion`)
  }

  saveDb(db)
}

export function getTaskReminders(taskId: string): TaskReminder[] {
  return getDb().task_reminders.filter((r) => r.task_id === taskId)
}

// ---- Log Operations ----
export function insertLog(log: TaskLog): void {
  const validation = TaskLogSchema.safeParse(log)
  if (!validation.success) {
    throw new Error(
      `Invalid log data: ${JSON.stringify(validation.error.format())}`
    )
  }

  const db = getDb()
  db.task_logs.push(validation.data)
  saveDb(db)
}

export function getTaskLogs(taskId: string): TaskLog[] {
  return getDb()
    .task_logs.filter((l) => l.task_id === taskId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}
