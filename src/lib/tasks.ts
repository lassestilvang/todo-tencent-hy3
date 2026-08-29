import { getDb } from './db'
import { eq, and, or, isNull, desc, asc, sql, inArray } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './db/schema'
import type {
  Task,
  List,
  Label,
  TaskAttachment,
  TaskReminder,
  TaskLog,
} from '@/types'
import { generateId, isDateBeforeToday, formatTime } from './utils'

// Database instance type (better-sqlite3 for both production and tests)
type DatabaseInstance = BetterSQLite3Database<typeof schema>

// Database instance can be overridden for testing
let dbInstanceOverride: DatabaseInstance | null = null

export function setDbInstanceForTesting(db: DatabaseInstance) {
  dbInstanceOverride = db
}

function getDatabase(): DatabaseInstance {
  return (dbInstanceOverride || getDb()) as DatabaseInstance
}

// Helper to convert Drizzle Task to App Task type
function mapTaskRow(row: typeof schema.tasks.$inferSelect): Task {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    date: row.date,
    deadline: row.deadline,
    estimate: row.estimate,
    actual_time: row.actualTime,
    priority: row.priority,
    recurring: row.recurring,
    list_id: row.listId,
    parent_task_id: row.parentTaskId,
    completed: row.completed,
    completed_at: row.completedAt,
    position: row.position,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapListRow(row: typeof schema.lists.$inferSelect): List {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    emoji: row.emoji,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapLabelRow(row: typeof schema.labels.$inferSelect): Label {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    created_at: row.createdAt,
  }
}

// Build relations for tasks
async function buildTaskRelations(
  taskRows: (typeof schema.tasks.$inferSelect)[]
): Promise<Task[]> {
  const db = getDatabase()
  
  const taskIds = taskRows.map(t => t.id)
  if (taskIds.length === 0) return []

  // Fetch all related data in parallel
  const [
    lists,
    labels,
    taskLabels,
    attachments,
    reminders,
    logs,
    allSubTasks,
  ] = await Promise.all([
    db.select().from(schema.lists).all(),
    db.select().from(schema.labels).all(),
    db.select().from(schema.taskLabels).where(inArray(schema.taskLabels.taskId, taskIds)).all(),
    db.select().from(schema.taskAttachments).where(inArray(schema.taskAttachments.taskId, taskIds)).all(),
    db.select().from(schema.taskReminders).where(inArray(schema.taskReminders.taskId, taskIds)).all(),
    db.select().from(schema.taskLogs).where(inArray(schema.taskLogs.taskId, taskIds)).all(),
    db.select().from(schema.tasks).where(inArray(schema.tasks.parentTaskId, taskIds)).all(),
  ])

  // Build lookup maps
  const listMap = new Map(lists.map((l) => [l.id, mapListRow(l)]))
  const labelMap = new Map(labels.map((l) => [l.id, mapLabelRow(l)]))
  const taskLabelsMap = new Map<string, string[]>()
  for (const tl of taskLabels) {
    if (!taskLabelsMap.has(tl.taskId)) taskLabelsMap.set(tl.taskId, [])
    taskLabelsMap.get(tl.taskId)!.push(tl.labelId)
  }
  const attachmentMap = new Map<string, TaskAttachment[]>()
  for (const att of attachments) {
    if (!attachmentMap.has(att.taskId)) attachmentMap.set(att.taskId, [])
    attachmentMap.get(att.taskId)!.push({
      id: att.id,
      task_id: att.taskId,
      file_name: att.fileName,
      file_path: att.filePath,
      file_size: att.fileSize,
      mime_type: att.mimeType,
      created_at: att.createdAt,
    })
  }
  const reminderMap = new Map<string, TaskReminder[]>()
  for (const rem of reminders) {
    if (!reminderMap.has(rem.taskId)) reminderMap.set(rem.taskId, [])
    reminderMap.get(rem.taskId)!.push({
      id: rem.id,
      task_id: rem.taskId,
      reminder_time: rem.reminderTime,
      sent: rem.sent,
      created_at: rem.createdAt,
    })
  }
  const logsMap = new Map<string, TaskLog[]>()
  for (const log of logs) {
    if (!logsMap.has(log.taskId)) logsMap.set(log.taskId, [])
    logsMap.get(log.taskId)!.push({
      id: log.id,
      task_id: log.taskId,
      action: log.action,
      details: log.details,
      created_at: log.createdAt,
    })
  }
  const subTasksMap = new Map<string, typeof schema.tasks.$inferSelect[]>()
  for (const sub of allSubTasks) {
    if (!subTasksMap.has(sub.parentTaskId!)) subTasksMap.set(sub.parentTaskId!, [])
    subTasksMap.get(sub.parentTaskId!)!.push(sub)
  }
  const allTasksMap = new Map(taskRows.map(t => [t.id, t]))

  // Recursively build task with relations
  function buildTask(taskRow: typeof schema.tasks.$inferSelect): Task {
    const baseTask = mapTaskRow(taskRow)
    const subTaskRows = subTasksMap.get(taskRow.id) || []
    const sortedSubTasks = subTaskRows
      .sort((a: typeof schema.tasks.$inferSelect, b: typeof schema.tasks.$inferSelect) => (a.position || 0) - (b.position || 0))
      .map(buildTask)

    return {
      ...baseTask,
      list: taskRow.listId ? listMap.get(taskRow.listId) : undefined,
      labels: (taskLabelsMap.get(taskRow.id) || [])
        .map(labelId => labelMap.get(labelId))
        .filter((l): l is Label => l !== undefined),
      sub_tasks: sortedSubTasks,
      attachments: attachmentMap.get(taskRow.id) || [],
      reminders: reminderMap.get(taskRow.id) || [],
      logs: (logsMap.get(taskRow.id) || []).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
    }
  }

  return taskRows.map(buildTask)
}

export function getLists(): List[] {
    const db = getDatabase()
  const lists = db.select().from(schema.lists).all()
  const tasks = db.select().from(schema.tasks).all()

  return lists
    .map((l) => {
      const listTasks = tasks.filter((t) => t.listId === l.id)
      return {
        ...mapListRow(l),
        task_count: listTasks.length,
        incomplete_count: listTasks.filter((t) => !t.completed).length,
      }
    })
    .sort((a: List, b: List) => {
      if (a.id === 'inbox') return -1
      if (b.id === 'inbox') return 1
      return a.name.localeCompare(b.name)
    })
}

export function createList(name: string, color: string, emoji: string): List {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.insert(schema.lists).values({
    id,
    name,
    color,
    emoji,
    createdAt: now,
    updatedAt: now,
  }).run()

  return { id, name, color, emoji, created_at: now, updated_at: now }
}

export function deleteList(id: string): void {
    const db = getDatabase()
  db.delete(schema.lists).where(eq(schema.lists.id, id)).run()
}

export function getLabels(): Label[] {
    const db = getDatabase()
  return db.select().from(schema.labels).all()
    .map(mapLabelRow)
    .sort((a: Label, b: Label) => a.name.localeCompare(b.name))
}

export function createLabel(name: string, color: string, icon: string): Label {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.insert(schema.labels).values({
    id,
    name,
    color,
    icon,
    createdAt: now,
  }).run()

  return { id, name, color, icon, created_at: now }
}

export function deleteLabel(id: string): void {
    const db = getDatabase()
  db.delete(schema.labels).where(eq(schema.labels.id, id)).run()
}

export async function getTasks(options?: {
  listId?: string
  labelId?: string
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  completed?: boolean
  search?: string
}): Promise<Task[]> {
    const db = getDatabase()

  let whereConditions = [isNull(schema.tasks.parentTaskId)]

  if (options?.listId) {
    whereConditions.push(eq(schema.tasks.listId, options.listId))
  }

  if (options?.labelId) {
    const taskIdsWithLabel = db.select({ taskId: schema.taskLabels.taskId })
      .from(schema.taskLabels)
      .where(eq(schema.taskLabels.labelId, options.labelId))
      .all()
    const ids = taskIdsWithLabel.map((t) => t.taskId)
    if (ids.length > 0) {
      whereConditions.push(inArray(schema.tasks.id, ids))
    } else {
      return [] // No tasks with this label
    }
  }

  if (options?.view) {
    const today = new Date().toISOString().split('T')[0]
    const next7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    switch (options.view) {
      case 'today':
        whereConditions.push(
          or(
            eq(schema.tasks.date, today),
            eq(schema.tasks.deadline, today)
          )!
        )
        break
      case 'next7':
        whereConditions.push(
          and(
            sql`${schema.tasks.date} IS NOT NULL`,
            sql`${schema.tasks.date} >= ${today}`,
            sql`${schema.tasks.date} <= ${next7Days}`
          )!
        )
        break
      case 'upcoming':
        whereConditions.push(
          and(
            sql`${schema.tasks.date} IS NOT NULL`,
            sql`${schema.tasks.date} >= ${today}`
          )!
        )
        break
    }
  }

  if (options?.completed !== undefined) {
    whereConditions.push(eq(schema.tasks.completed, options.completed))
  }

  if (options?.search) {
    const search = options.search.toLowerCase()
    whereConditions.push(
      or(
        sql`lower(${schema.tasks.name}) LIKE ${'%' + search + '%'}`,
        sql`lower(${schema.tasks.description}) LIKE ${'%' + search + '%'}`
      )!
    )
  }

  const taskRows = db.select()
    .from(schema.tasks)
    .where(and(...whereConditions))
    .orderBy(
      asc(schema.tasks.completed),
      sql`CASE ${schema.tasks.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END`,
      asc(schema.tasks.position)
    )
    .all()

  return buildTaskRelations(taskRows)
}

export async function getTask(id: string): Promise<Task | undefined> {
    const db = getDatabase()
  const taskRow = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get()
  if (!taskRow) return undefined

  const [task] = await buildTaskRelations([taskRow])
  return task
}

export function createTask(data: Partial<Task>): Task {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const taskData = {
    id,
    name: data.name || '',
    description: data.description || null,
    date: data.date || null,
    deadline: data.deadline || null,
    estimate: data.estimate || null,
    actualTime: data.actual_time || 0,
    priority: data.priority || 'none',
    recurring: data.recurring || null,
    listId: data.list_id || null,
    parentTaskId: data.parent_task_id || null,
    completed: data.completed || false,
    completedAt: null,
    position: data.position || 0,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(schema.tasks).values(taskData).run()
  logTaskAction(id, 'created', `Task "${data.name}" created`)

  // Return task with relations
  const task = mapTaskRow(taskData)
  return {
    ...task,
    list: task.list_id ? getLists().find((l) => l.id === task.list_id) : undefined,
    labels: [],
    sub_tasks: [],
    attachments: [],
    reminders: [],
    logs: [],
  }
}

export function updateTask(id: string, data: Partial<Task>): void {
    const db = getDatabase()

  const oldTask = getDatabase().select().from(schema.tasks).where(eq(schema.tasks.id, id)).get()
  if (!oldTask) return

  const updateData: Partial<typeof schema.tasks.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.date !== undefined) updateData.date = data.date
  if (data.deadline !== undefined) updateData.deadline = data.deadline
  if (data.estimate !== undefined) updateData.estimate = data.estimate
  if (data.actual_time !== undefined) updateData.actualTime = data.actual_time
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.recurring !== undefined) updateData.recurring = data.recurring
  if (data.list_id !== undefined) updateData.listId = data.list_id
  if (data.parent_task_id !== undefined) updateData.parentTaskId = data.parent_task_id
  if (data.completed !== undefined) {
    updateData.completed = data.completed
    updateData.completedAt = data.completed ? new Date().toISOString() : null
  }
  if (data.position !== undefined) updateData.position = data.position

  db.update(schema.tasks)
    .set(updateData)
    .where(eq(schema.tasks.id, id))
    .run()

  if (oldTask) {
    const changes = Object.keys(data).filter(
      (k: string) => data[k as keyof Task] !== (oldTask as any)[k as keyof typeof oldTask]
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

export async function toggleTaskComplete(id: string): Promise<void> {
    const db = getDatabase()

  const task = await getTask(id)
  if (!task) return

  const completed = !task.completed
  const completedAt = completed ? new Date().toISOString() : null

  const subIds = task.sub_tasks ? collectSubTaskIds(task.sub_tasks) : []
  const allIds = [id, ...subIds]

  const now = new Date().toISOString()
  for (const tid of allIds) {
    db.update(schema.tasks)
      .set({ completed, completedAt, updatedAt: now })
      .where(eq(schema.tasks.id, tid))
      .run()
  }

  logTaskAction(id, completed ? 'completed' : 'reopened', `Task ${completed ? 'completed' : 'reopened'}`)

  // Handle recurring tasks - create next occurrence
  if (completed && task.recurring) {
    await createNextOccurrence(task)
  }
}

async function createNextOccurrence(task: Task): Promise<void> {
  const db = getDatabase()
  
  const now = new Date()
  let nextDate: string | null = null
  let nextDeadline: string | null = null

  const calculateNextDate = (baseDate: string | null, type: string): string | null => {
    if (!baseDate) return null
    const date = new Date(baseDate)
    switch (type) {
      case 'every_day':
        date.setDate(date.getDate() + 1)
        break
      case 'every_week':
        date.setDate(date.getDate() + 7)
        break
      case 'every_weekday':
        // Find next weekday (skip weekends)
        do {
          date.setDate(date.getDate() + 1)
        } while (date.getDay() === 0 || date.getDay() === 6)
        break
      case 'every_month':
        date.setMonth(date.getMonth() + 1)
        // Handle month-end edge case
        if (date.getDate() !== new Date(baseDate).getDate()) {
          date.setDate(0) // Last day of previous month
        }
        break
      case 'every_year':
        date.setFullYear(date.getFullYear() + 1)
        break
      case 'custom':
        // For custom, don't auto-create (user handles manually)
        return null
    }
    return date.toISOString().split('T')[0]
  }

  if (task.date) {
    nextDate = calculateNextDate(task.date, task.recurring ?? 'every_day')
  }
  if (task.deadline) {
    nextDeadline = calculateNextDate(task.deadline, task.recurring ?? 'every_day')
  }

  // Only create if we have at least one date
  if (nextDate || nextDeadline) {
    const newTask = {
      id: generateId(),
      name: task.name,
      description: task.description,
      date: nextDate,
      deadline: nextDeadline,
      estimate: task.estimate,
      actualTime: 0,
      priority: task.priority,
      recurring: task.recurring,
      listId: task.list_id,
      parentTaskId: null,
      completed: false,
      completedAt: null,
      position: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    db.insert(schema.tasks).values(newTask).run()

    // Copy labels to new task
    if (task.labels && task.labels.length > 0) {
      for (const label of task.labels) {
        db.insert(schema.taskLabels).values({
          taskId: newTask.id,
          labelId: label.id,
        }).onConflictDoNothing().run()
      }
    }

    logTaskAction(newTask.id, 'created', `Recurring task created from "${task.name}"`)
  }
}

export function deleteTask(id: string): void {
    const db = getDatabase()

  // Get all subtask IDs first (cascade delete will handle this via FK, but we need for related data)
  const subtasks = db.select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(eq(schema.tasks.parentTaskId, id))
    .all()
  const allIds = [id, ...subtasks.map((s) => s.id)]

  // Delete related data
  db.delete(schema.taskLabels).where(inArray(schema.taskLabels.taskId, allIds)).run()
  db.delete(schema.taskAttachments).where(inArray(schema.taskAttachments.taskId, allIds)).run()
  db.delete(schema.taskReminders).where(inArray(schema.taskReminders.taskId, allIds)).run()
  db.delete(schema.taskLogs).where(inArray(schema.taskLogs.taskId, allIds)).run()
  db.delete(schema.taskDependencies).where(
    or(
      inArray(schema.taskDependencies.blockingTaskId, allIds),
      inArray(schema.taskDependencies.blockedTaskId, allIds)
    )!
  ).run()

  // Delete tasks (cascade handles subtasks)
  db.delete(schema.tasks).where(eq(schema.tasks.id, id)).run()
}

export function clearCompletedTasks(): void {
    const db = getDatabase()

  const completedTasks = db.select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(eq(schema.tasks.completed, true))
    .all()

  if (completedTasks.length === 0) return

  const ids = completedTasks.map((t) => t.id)

  // Delete related data
  db.delete(schema.taskLabels).where(inArray(schema.taskLabels.taskId, ids)).run()
  db.delete(schema.taskAttachments).where(inArray(schema.taskAttachments.taskId, ids)).run()
  db.delete(schema.taskReminders).where(inArray(schema.taskReminders.taskId, ids)).run()
  db.delete(schema.taskLogs).where(inArray(schema.taskLogs.taskId, ids)).run()
  db.delete(schema.taskDependencies).where(
    or(
      inArray(schema.taskDependencies.blockingTaskId, ids),
      inArray(schema.taskDependencies.blockedTaskId, ids)
    )!
  ).run()

  db.delete(schema.tasks).where(inArray(schema.tasks.id, ids)).run()
}

export function getTaskLabels(taskId: string): Label[] {
    const db = getDatabase()
  const labels = db.select()
    .from(schema.labels)
    .innerJoin(schema.taskLabels, eq(schema.labels.id, schema.taskLabels.labelId))
    .where(eq(schema.taskLabels.taskId, taskId))
    .all()

  return labels.map((l) => mapLabelRow(l.labels))
}

export function addTaskLabel(taskId: string, labelId: string): void {
    const db = getDatabase()
  db.insert(schema.taskLabels).values({ taskId, labelId }).onConflictDoNothing().run()
  logTaskAction(taskId, 'label_added', `Label ${labelId} added`)
}

export function removeTaskLabel(taskId: string, labelId: string): void {
    const db = getDatabase()
  db.delete(schema.taskLabels)
    .where(and(eq(schema.taskLabels.taskId, taskId), eq(schema.taskLabels.labelId, labelId)))
    .run()
  logTaskAction(taskId, 'label_removed', `Label ${labelId} removed`)
}

export function getTaskAttachments(taskId: string): TaskAttachment[] {
    const db = getDatabase()
  return db.select().from(schema.taskAttachments)
    .where(eq(schema.taskAttachments.taskId, taskId))
    .all()
    .map((att) => ({
      id: att.id,
      task_id: att.taskId,
      file_name: att.fileName,
      file_path: att.filePath,
      file_size: att.fileSize,
      mime_type: att.mimeType,
      created_at: att.createdAt,
    }))
}

export function addTaskAttachment(
  taskId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  mimeType?: string
): void {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.insert(schema.taskAttachments).values({
    id,
    taskId,
    fileName,
    filePath,
    fileSize,
    mimeType: mimeType || null,
    createdAt: now,
  }).run()

  logTaskAction(taskId, 'attachment_added', `File "${fileName}" attached`)
}

export function removeTaskAttachment(attachmentId: string): void {
    const db = getDatabase()
  const att = db.select().from(schema.taskAttachments).where(eq(schema.taskAttachments.id, attachmentId)).get()
  if (att) {
    db.delete(schema.taskAttachments).where(eq(schema.taskAttachments.id, attachmentId)).run()
    logTaskAction(att.taskId, 'attachment_removed', `File "${att.fileName}" removed`)
  }
}

export function getTaskReminders(taskId: string): TaskReminder[] {
    const db = getDatabase()
  return db.select().from(schema.taskReminders)
    .where(eq(schema.taskReminders.taskId, taskId))
    .all()
    .map((rem) => ({
      id: rem.id,
      task_id: rem.taskId,
      reminder_time: rem.reminderTime,
      sent: rem.sent,
      created_at: rem.createdAt,
    }))
}

export function addTaskReminder(taskId: string, reminderTime: string): void {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.insert(schema.taskReminders).values({
    id,
    taskId,
    reminderTime,
    sent: false,
    createdAt: now,
  }).run()

  logTaskAction(taskId, 'reminder_added', `Reminder set for ${reminderTime}`)
}

export function removeTaskReminder(reminderId: string): void {
    const db = getDatabase()
  db.delete(schema.taskReminders).where(eq(schema.taskReminders.id, reminderId)).run()
}

export function getTaskLogs(taskId: string): TaskLog[] {
    const db = getDatabase()
  return db.select().from(schema.taskLogs)
    .where(eq(schema.taskLogs.taskId, taskId))
    .orderBy(desc(schema.taskLogs.createdAt))
    .all()
    .map((log) => ({
      id: log.id,
      task_id: log.taskId,
      action: log.action,
      details: log.details,
      created_at: log.createdAt,
    }))
}

function logTaskAction(taskId: string, action: string, details: string): void {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.insert(schema.taskLogs).values({
    id,
    taskId,
    action,
    details,
    createdAt: now,
  }).run()
}

export async function getOverdueTasks(): Promise<Task[]> {
    const db = getDatabase()

  const today = new Date().toISOString().split('T')[0]

  const taskRows = db.select()
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.completed, false),
        isNull(schema.tasks.parentTaskId),
        or(
          and(sql`${schema.tasks.date} IS NOT NULL`, sql`${schema.tasks.date} < ${today}`),
          and(sql`${schema.tasks.deadline} IS NOT NULL`, sql`${schema.tasks.deadline} < ${today}`)
        )!
      )
    )
    .orderBy(asc(schema.tasks.date), asc(schema.tasks.deadline))
    .all()

  return buildTaskRelations(taskRows)
}

export async function searchTasks(query: string): Promise<Task[]> {
    const db = getDatabase()

  const search = query.toLowerCase()

  const taskRows = db.select()
    .from(schema.tasks)
    .where(
      and(
        isNull(schema.tasks.parentTaskId),
        or(
          sql`lower(${schema.tasks.name}) LIKE ${'%' + search + '%'}`,
          sql`lower(${schema.tasks.description}) LIKE ${'%' + search + '%'}`
        )!
      )
    )
    .orderBy(desc(schema.tasks.createdAt))
    .limit(50)
    .all()

  return buildTaskRelations(taskRows)
}

// Task Dependencies
export function getTaskDependencies(taskId: string): { blocking: Task[]; blocked: Task[] } {
    const db = getDatabase()

  const blocking = db.select()
    .from(schema.taskDependencies)
    .innerJoin(schema.tasks, eq(schema.taskDependencies.blockingTaskId, schema.tasks.id))
    .where(eq(schema.taskDependencies.blockedTaskId, taskId))
    .all()

  const blocked = db.select()
    .from(schema.taskDependencies)
    .innerJoin(schema.tasks, eq(schema.taskDependencies.blockedTaskId, schema.tasks.id))
    .where(eq(schema.taskDependencies.blockingTaskId, taskId))
    .all()

  return {
    blocking: blocking.map((b) => mapTaskRow(b.tasks)),
    blocked: blocked.map((b) => mapTaskRow(b.tasks)),
  }
}

export function addTaskDependency(blockingTaskId: string, blockedTaskId: string, type: 'blocks' | 'relates' | 'duplicates' = 'blocks'): void {
    const db = getDatabase()
  const id = generateId()

  db.insert(schema.taskDependencies).values({
    id,
    blockingTaskId,
    blockedTaskId,
    type,
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().run()
}

export function removeTaskDependency(blockingTaskId: string, blockedTaskId: string): void {
    const db = getDatabase()
  db.delete(schema.taskDependencies)
    .where(and(
      eq(schema.taskDependencies.blockingTaskId, blockingTaskId),
      eq(schema.taskDependencies.blockedTaskId, blockedTaskId)
    ))
    .run()
}

export function canCompleteTask(taskId: string): { canComplete: boolean; blockingTasks: Task[] } {
    const db = getDatabase()

  const blocking = db.select()
    .from(schema.taskDependencies)
    .innerJoin(schema.tasks, eq(schema.taskDependencies.blockingTaskId, schema.tasks.id))
    .where(
      and(
        eq(schema.taskDependencies.blockedTaskId, taskId),
        eq(schema.taskDependencies.type, 'blocks'),
        eq(schema.tasks.completed, false)
      )
    )
    .all()

  return {
    canComplete: blocking.length === 0,
    blockingTasks: blocking.map((b) => mapTaskRow(b.tasks)),
  }
}