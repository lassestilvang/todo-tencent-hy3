import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Lists table
export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

// Labels table
export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

// Tasks table
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  date: text('date'),
  deadline: text('deadline'),
  estimate: integer('estimate'),
  actualTime: integer('actual_time').notNull().default(0),
  priority: text('priority', { enum: ['high', 'medium', 'low', 'none'] })
    .notNull()
    .default('none'),
  recurring: text('recurring', {
    enum: ['every_day', 'every_week', 'every_weekday', 'every_month', 'every_year', 'custom'],
  }),
  listId: text('list_id').references(() => lists.id, { onDelete: 'set null' }),
  parentTaskId: text('parent_task_id').references((): typeof tasks => tasks, { onDelete: 'cascade' }),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: text('completed_at'),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  listIdIdx: index('tasks_list_id_idx').on(table.listId),
  parentTaskIdIdx: index('tasks_parent_task_id_idx').on(table.parentTaskId),
  completedIdx: index('tasks_completed_idx').on(table.completed),
  dateIdx: index('tasks_date_idx').on(table.date),
  deadlineIdx: index('tasks_deadline_idx').on(table.deadline),
}))

// Task-Labels many-to-many
export const taskLabels = sqliteTable('task_labels', {
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  labelId: text('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: uniqueIndex('task_labels_pk').on(table.taskId, table.labelId),
  taskIdIdx: index('task_labels_task_id_idx').on(table.taskId),
  labelIdIdx: index('task_labels_label_id_idx').on(table.labelId),
}))

// Task Attachments
export const taskAttachments = sqliteTable('task_attachments', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  taskIdIdx: index('task_attachments_task_id_idx').on(table.taskId),
}))

// Task Reminders
export const taskReminders = sqliteTable('task_reminders', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  reminderTime: text('reminder_time').notNull(),
  sent: integer('sent', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  taskIdIdx: index('task_reminders_task_id_idx').on(table.taskId),
  sentIdx: index('task_reminders_sent_idx').on(table.sent),
}))

// Task Logs (audit trail)
export const taskLogs = sqliteTable('task_logs', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  taskIdIdx: index('task_logs_task_id_idx').on(table.taskId),
  createdAtIdx: index('task_logs_created_at_idx').on(table.createdAt),
}))

// Task Dependencies (new feature)
export const taskDependencies = sqliteTable('task_dependencies', {
  id: text('id').primaryKey(),
  blockingTaskId: text('blocking_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  blockedTaskId: text('blocked_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['blocks', 'relates', 'duplicates'] }).notNull().default('blocks'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  pk: uniqueIndex('task_dependencies_pk').on(table.blockingTaskId, table.blockedTaskId),
  blockingIdx: index('task_dependencies_blocking_idx').on(table.blockingTaskId),
  blockedIdx: index('task_dependencies_blocked_idx').on(table.blockedTaskId),
}))

// Type exports for TypeScript
export type List = typeof lists.$inferSelect
export type NewList = typeof lists.$inferInsert
export type Label = typeof labels.$inferSelect
export type NewLabel = typeof labels.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type TaskLabel = typeof taskLabels.$inferSelect
export type NewTaskLabel = typeof taskLabels.$inferInsert
export type TaskAttachment = typeof taskAttachments.$inferSelect
export type NewTaskAttachment = typeof taskAttachments.$inferInsert
export type TaskReminder = typeof taskReminders.$inferSelect
export type NewTaskReminder = typeof taskReminders.$inferInsert
export type TaskLog = typeof taskLogs.$inferSelect
export type NewTaskLog = typeof taskLogs.$inferInsert
export type TaskDependency = typeof taskDependencies.$inferSelect
export type NewTaskDependency = typeof taskDependencies.$inferInsert