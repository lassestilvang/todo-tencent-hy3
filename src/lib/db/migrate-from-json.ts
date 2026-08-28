/**
 * Migration script to import data from tasks.json to SQLite
 * Run with: npx tsx src/lib/db/migrate-from-json.ts
 */
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { sql } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(process.cwd(), 'tasks.db')
const jsonPath = path.join(process.cwd(), 'tasks.json')

if (!fs.existsSync(jsonPath)) {
  console.log('No tasks.json found, skipping migration')
  process.exit(0)
}

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })

// Read and parse JSON
const rawData = fs.readFileSync(jsonPath, 'utf-8')
const jsonData = JSON.parse(rawData)

console.log('Starting migration from tasks.json...')

// Migrate lists
if (jsonData.lists?.length) {
  console.log(`Migrating ${jsonData.lists.length} lists...`)
  for (const list of jsonData.lists) {
    db.insert(schema.lists).values({
      id: list.id,
      name: list.name,
      color: list.color,
      emoji: list.emoji,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
    }).onConflictDoUpdate({
      target: schema.lists.id,
      set: {
        name: list.name,
        color: list.color,
        emoji: list.emoji,
        updatedAt: list.updated_at,
      },
    }).run()
  }
}

// Migrate labels
if (jsonData.labels?.length) {
  console.log(`Migrating ${jsonData.labels.length} labels...`)
  for (const label of jsonData.labels) {
    db.insert(schema.labels).values({
      id: label.id,
      name: label.name,
      color: label.color,
      icon: label.icon,
      createdAt: label.created_at,
    }).onConflictDoUpdate({
      target: schema.labels.id,
      set: {
        name: label.name,
        color: label.color,
        icon: label.icon,
      },
    }).run()
  }
}

// Migrate tasks
if (jsonData.tasks?.length) {
  console.log(`Migrating ${jsonData.tasks.length} tasks...`)
  for (const task of jsonData.tasks) {
    db.insert(schema.tasks).values({
      id: task.id,
      name: task.name,
      description: task.description,
      date: task.date,
      deadline: task.deadline,
      estimate: task.estimate,
      actualTime: task.actual_time || 0,
      priority: task.priority,
      recurring: task.recurring,
      listId: task.list_id,
      parentTaskId: task.parent_task_id,
      completed: task.completed === 1 || task.completed === true,
      completedAt: task.completed_at,
      position: task.position || 0,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    }).onConflictDoUpdate({
      target: schema.tasks.id,
      set: {
        name: task.name,
        description: task.description,
        date: task.date,
        deadline: task.deadline,
        estimate: task.estimate,
        actualTime: task.actual_time || 0,
        priority: task.priority,
        recurring: task.recurring,
        listId: task.list_id,
        parentTaskId: task.parent_task_id,
        completed: task.completed === 1 || task.completed === true,
        completedAt: task.completed_at,
        position: task.position || 0,
        updatedAt: task.updated_at,
      },
    }).run()
  }
}

// Migrate task_labels
if (jsonData.task_labels?.length) {
  console.log(`Migrating ${jsonData.task_labels.length} task-label associations...`)
  for (const tl of jsonData.task_labels) {
    db.insert(schema.taskLabels).values({
      taskId: tl.task_id,
      labelId: tl.label_id,
    }).onConflictDoNothing().run()
  }
}

// Migrate task_attachments
if (jsonData.task_attachments?.length) {
  console.log(`Migrating ${jsonData.task_attachments.length} attachments...`)
  for (const att of jsonData.task_attachments) {
    db.insert(schema.taskAttachments).values({
      id: att.id,
      taskId: att.task_id,
      fileName: att.file_name,
      filePath: att.file_path,
      fileSize: att.file_size,
      mimeType: att.mime_type,
      createdAt: att.created_at,
    }).onConflictDoUpdate({
      target: schema.taskAttachments.id,
      set: {
        taskId: att.task_id,
        fileName: att.file_name,
        filePath: att.file_path,
        fileSize: att.file_size,
        mimeType: att.mime_type,
      },
    }).run()
  }
}

// Migrate task_reminders
if (jsonData.task_reminders?.length) {
  console.log(`Migrating ${jsonData.task_reminders.length} reminders...`)
  for (const rem of jsonData.task_reminders) {
    db.insert(schema.taskReminders).values({
      id: rem.id,
      taskId: rem.task_id,
      reminderTime: rem.reminder_time,
      sent: rem.sent === 1 || rem.sent === true,
      createdAt: rem.created_at,
    }).onConflictDoUpdate({
      target: schema.taskReminders.id,
      set: {
        taskId: rem.task_id,
        reminderTime: rem.reminder_time,
        sent: rem.sent === 1 || rem.sent === true,
      },
    }).run()
  }
}

// Migrate task_logs
if (jsonData.task_logs?.length) {
  console.log(`Migrating ${jsonData.task_logs.length} logs...`)
  for (const log of jsonData.task_logs) {
    db.insert(schema.taskLogs).values({
      id: log.id,
      taskId: log.task_id,
      action: log.action,
      details: log.details,
      createdAt: log.created_at,
    }).onConflictDoUpdate({
      target: schema.taskLogs.id,
      set: {
        taskId: log.task_id,
        action: log.action,
        details: log.details,
      },
    }).run()
  }
}

console.log('Migration completed successfully!')

// Verify counts
const counts = {
  lists: db.select({ count: sql`count(*)` }).from(schema.lists).get(),
  labels: db.select({ count: sql`count(*)` }).from(schema.labels).get(),
  tasks: db.select({ count: sql`count(*)` }).from(schema.tasks).get(),
  taskLabels: db.select({ count: sql`count(*)` }).from(schema.taskLabels).get(),
  taskAttachments: db.select({ count: sql`count(*)` }).from(schema.taskAttachments).get(),
  taskReminders: db.select({ count: sql`count(*)` }).from(schema.taskReminders).get(),
  taskLogs: db.select({ count: sql`count(*)` }).from(schema.taskLogs).get(),
}

console.log('Final counts:', counts)