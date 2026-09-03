import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

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

// Tasks table - declare type first to break circular reference
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
  // External calendar event ID this task was imported from (e.g. Google).
  // Lets sync update the source event instead of creating a duplicate.
  sourceEventId: text('source_event_id'),
  // Self-referential FK - use AnySQLiteColumn to break circular reference
  parentTaskId: text('parent_task_id').references(((): AnySQLiteColumn => tasks.id), { onDelete: 'cascade' }),
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

// Task Templates
// listId is a soft reference (no FK) so templates can target lists that are
// later deleted; tags are stored as a JSON-encoded string[].
export const taskTemplates = sqliteTable('task_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['high', 'medium', 'low', 'none'] }),
  estimate: integer('estimate'),
  recurring: text('recurring', {
    enum: ['every_day', 'every_week', 'every_weekday', 'every_month', 'every_year', 'custom'],
  }),
  listId: text('list_id'),
  tags: text('tags'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  nameIdx: index('task_templates_name_idx').on(table.name),
  createdAtIdx: index('task_templates_created_at_idx').on(table.createdAt),
}))

// Webhooks
// events is a JSON-encoded WebhookEvent[]; timestamps are epoch milliseconds.
export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: text('events').notNull(),
  secret: text('secret').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  lastTriggered: integer('last_triggered'),
  lastError: text('last_error'),
}, (table) => ({
  activeIdx: index('webhooks_active_idx').on(table.active),
}))

// Share Links
// listId is a soft reference (no FK) so links survive list deletion.
export const shareLinks = sqliteTable('share_links', {
  id: text('id').primaryKey(),
  token: text('token').notNull(),
  listId: text('list_id').notNull(),
  permission: text('permission', { enum: ['view', 'comment', 'edit'] }).notNull(),
  expiresAt: integer('expires_at'),
  passwordHash: text('password_hash'),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by').notNull(),
  accessCount: integer('access_count').notNull().default(0),
  lastAccessed: integer('last_accessed'),
}, (table) => ({
  tokenIdx: uniqueIndex('share_links_token_idx').on(table.token),
  listIdIdx: index('share_links_list_id_idx').on(table.listId),
}))

// Workspaces
// settings is a JSON-encoded WorkspaceSettings object.
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  settings: text('settings').notNull(),
})

// Workspace Members
export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
  joinedAt: integer('joined_at').notNull(),
  avatarUrl: text('avatar_url'),
}, (table) => ({
  workspaceIdx: index('workspace_members_workspace_idx').on(table.workspaceId),
  userIdx: index('workspace_members_user_idx').on(table.userId),
}))

// Workspace Invitations
export const workspaceInvitations = sqliteTable('workspace_invitations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  email: text('email').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
  invitedBy: text('invited_by').notNull(),
  invitedByName: text('invited_by_name').notNull(),
  status: text('status', { enum: ['pending', 'accepted', 'declined', 'expired'] }).notNull().default('pending'),
  token: text('token').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
  acceptedAt: integer('accepted_at'),
}, (table) => ({
  workspaceIdx: index('workspace_invitations_workspace_idx').on(table.workspaceId),
  tokenIdx: uniqueIndex('workspace_invitations_token_idx').on(table.token),
}))

// Workspace Activity
export const workspaceActivity = sqliteTable('workspace_activity', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  entityType: text('entity_type', { enum: ['task', 'list', 'member', 'invitation', 'comment', 'workspace'] }).notNull(),
  entityId: text('entity_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  workspaceIdx: index('workspace_activity_workspace_idx').on(table.workspaceId),
  createdAtIdx: index('workspace_activity_created_at_idx').on(table.createdAt),
}))

// Task Comments
// mentions is a JSON-encoded string[] of mentioned userIds.
export const taskComments = sqliteTable('task_comments', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  workspaceId: text('workspace_id').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  userAvatar: text('user_avatar'),
  content: text('content').notNull(),
  mentions: text('mentions').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
}, (table) => ({
  taskIdx: index('task_comments_task_idx').on(table.taskId),
  workspaceIdx: index('task_comments_workspace_idx').on(table.workspaceId),
}))

// Push Subscriptions
// Stores web-push subscriptions so the server can deliver notifications
// without the client supplying the full subscription each time.
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userId: text('user_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  endpointIdx: uniqueIndex('push_subscriptions_endpoint_idx').on(table.endpoint),
  userIdx: index('push_subscriptions_user_idx').on(table.userId),
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
export type TaskTemplateRow = typeof taskTemplates.$inferSelect
export type NewTaskTemplate = typeof taskTemplates.$inferInsert
export type WebhookRow = typeof webhooks.$inferSelect
export type NewWebhook = typeof webhooks.$inferInsert
export type ShareLinkRow = typeof shareLinks.$inferSelect
export type NewShareLink = typeof shareLinks.$inferInsert
export type WorkspaceRow = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
export type WorkspaceInvitationRow = typeof workspaceInvitations.$inferSelect
export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert
export type WorkspaceActivityRow = typeof workspaceActivity.$inferSelect
export type NewWorkspaceActivity = typeof workspaceActivity.$inferInsert
export type TaskCommentRow = typeof taskComments.$inferSelect
export type NewTaskComment = typeof taskComments.$inferInsert
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert