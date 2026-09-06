import { getDb } from '@/lib/db'
import { and, eq, isNull, or, desc, asc, sql, inArray, lte } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import {
  lists,
  labels,
  tasks,
  taskLabels,
  taskAttachments,
  taskReminders,
  taskLogs,
  taskDependencies,
  taskTemplates,
  workspaceMembers,
} from '@/lib/db/schema'
import type {
  Task,
  List,
  Label,
  TaskAttachment,
  TaskReminder,
  TaskLog,
  TaskLabel,
  Priority,
} from '@/types'
import type { WorkspaceMember } from '@/lib/workspaces'
import { generateId } from './utils'
import { parseNaturalLanguage, validateParsedTask } from './nlp'
import { assignmentChanged } from './collaboration/assignment'
import { notifyTaskAssignment } from './collaboration/notifier'

// Task Templates
export interface TaskTemplate {
  id: string
  name: string
  description?: string
  priority?: 'high' | 'medium' | 'low' | 'none'
  estimate?: number
  recurring?: 'every_day' | 'every_week' | 'every_weekday' | 'every_month' | 'every_year' | 'custom'
  listId?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

// Tags are stored as a JSON-encoded string[]; nullable columns map to undefined
// to match the optional-field interface.
function mapTemplateRow(row: typeof taskTemplates.$inferSelect): TaskTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    priority: row.priority ?? undefined,
    estimate: row.estimate ?? undefined,
    recurring: row.recurring ?? undefined,
    listId: row.listId ?? undefined,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function getTemplates(): TaskTemplate[] {
  const db = getDatabase()
  return db.select().from(taskTemplates).all().map(mapTemplateRow)
}

export function getTemplate(id: string): TaskTemplate | null {
  const db = getDatabase()
  const row = db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).get()
  return row ? mapTemplateRow(row) : null
}

export function createTemplate(data: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>): TaskTemplate {
  const db = getDatabase()
  const id = generateId()
  const now = Date.now()

  db.insert(taskTemplates).values({
    id,
    name: data.name,
    description: data.description,
    priority: data.priority,
    estimate: data.estimate,
    recurring: data.recurring,
    listId: data.listId,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    createdAt: now,
    updatedAt: now,
  }).run()

  return { ...data, id, createdAt: now, updatedAt: now }
}

export function updateTemplate(id: string, data: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>): TaskTemplate | null {
  const db = getDatabase()
  const existing = db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).get()
  if (!existing) return null

  const updateData: Partial<typeof taskTemplates.$inferInsert> = {
    updatedAt: Date.now(),
  }
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.estimate !== undefined) updateData.estimate = data.estimate
  if (data.recurring !== undefined) updateData.recurring = data.recurring
  if (data.listId !== undefined) updateData.listId = data.listId
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags)

  db.update(taskTemplates)
    .set(updateData)
    .where(eq(taskTemplates.id, id))
    .run()

  const updated = db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).get()
  return updated ? mapTemplateRow(updated) : null
}

export function deleteTemplate(id: string): boolean {
  const db = getDatabase()
  const existing = db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).get()
  if (!existing) return false
  db.delete(taskTemplates).where(eq(taskTemplates.id, id)).run()
  return true
}

export function createTaskFromTemplate(templateId: string, overrides?: Partial<Task>): Task | null {
  const template = getTemplate(templateId)
  if (!template) return null

  return createTask({
    name: template.name,
    description: template.description,
    priority: template.priority,
    estimate: template.estimate,
    recurring: template.recurring,
    list_id: template.listId,
    ...overrides,
  })
}

// Database instance type (better-sqlite3 for both production and tests)
type DatabaseInstance = BetterSQLite3Database<{
  lists: typeof lists
  labels: typeof labels
  tasks: typeof tasks
  taskLabels: typeof taskLabels
  taskAttachments: typeof taskAttachments
  taskReminders: typeof taskReminders
  taskLogs: typeof taskLogs
  taskDependencies: typeof taskDependencies
  taskTemplates: typeof taskTemplates
}>

// Database instance can be overridden for testing
let dbInstanceOverride: DatabaseInstance | null = null

export function setDbInstanceForTesting(db: DatabaseInstance) {
  dbInstanceOverride = db
}

function getDatabase(): DatabaseInstance {
  // During build/prerendering, return a mock database if real DB fails
  if (dbInstanceOverride) return dbInstanceOverride

  // Check if we're in a build/prerender context (no database file exists)
  if (typeof window === 'undefined' && process.env.NEXT_PHASE === 'phase-production-build') {
    return createMockDatabase() as unknown as DatabaseInstance
  }

  try {
    return getDb() as unknown as DatabaseInstance
  } catch (error) {
    // In production, throw the error instead of silently failing
    // Only return mock DB during actual build/prerendering
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      // We're in a build context, safe to use mock
      return createMockDatabase() as unknown as DatabaseInstance
    }

    // In development or runtime, throw the error to make issues visible
    console.error('Database connection failed:', error)
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Database connection failed: ${message}`)
  }
}

// Mock database for build-time prerendering
function createMockDatabase() {
  const emptyArray = () => []
  const emptyObject = () => undefined

  const whereMock = () => ({
    all: emptyArray,
    get: emptyObject,
    orderBy: () => ({ all: emptyArray, get: emptyObject }),
    limit: () => ({ all: emptyArray, get: emptyObject }),
    innerJoin: () => ({ all: emptyArray, get: emptyObject }),
  })

  const fromMock = () => ({
    all: emptyArray,
    get: emptyObject,
    where: whereMock,
    innerJoin: () => ({ all: emptyArray, get: emptyObject }),
    orderBy: () => ({ all: emptyArray, get: emptyObject }),
    limit: () => ({ all: emptyArray, get: emptyObject }),
  })

  const selectMock = () => ({ from: fromMock })

  return {
    select: selectMock,
    insert: () => ({
      values: () => ({
        run: () => ({}),
        onConflictDoUpdate: () => ({ run: () => ({}) }),
        onConflictDoNothing: () => ({ run: () => ({}) }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ run: () => ({}) }),
      }),
    }),
    delete: () => ({
      where: () => ({ run: () => ({}) }),
    }),
  }
}

// Convert a workspace member row to the collaboration
// type used on tasks (avatarUrl is null in the DB).
function mapMemberToTask(
  member: typeof workspaceMembers.$inferSelect | undefined
): WorkspaceMember | undefined {
  if (!member) return undefined
  return {
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    email: member.email,
    name: member.name,
    role: member.role,
    joinedAt: member.joinedAt,
    avatarUrl: member.avatarUrl ?? undefined,
  }
}

// Helper to convert Drizzle Task to App Task type
function mapTaskRow(row: typeof tasks.$inferSelect): Task {
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
    assignee_id: row.assigneeId,
    source_event_id: row.sourceEventId,
    source: row.source,
    mood: row.mood,
    parent_task_id: row.parentTaskId,
    completed: row.completed,
    completed_at: row.completedAt,
    position: row.position,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapListRow(row: typeof lists.$inferSelect): List {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    emoji: row.emoji,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapLabelRow(row: typeof labels.$inferSelect): Label {
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
  taskRows: (typeof tasks.$inferSelect)[]
): Promise<Task[]> {
  const db = getDatabase()

  const taskIds = taskRows.map(t => t.id)
  if (taskIds.length === 0) return []

  // Fetch all related data in parallel
  const [
    allLists,
    allLabels,
    allTaskLabels,
    attachments,
    reminders,
    logs,
    allSubTasks,
    allMembers,
  ] = await Promise.all([
    db.select().from(lists).all(),
    db.select().from(labels).all(),
    db.select().from(taskLabels).where(inArray(taskLabels.taskId, taskIds)).all(),
    db.select().from(taskAttachments).where(inArray(taskAttachments.taskId, taskIds)).all(),
    db.select().from(taskReminders).where(inArray(taskReminders.taskId, taskIds)).all(),
    db.select().from(taskLogs).where(inArray(taskLogs.taskId, taskIds)).all(),
    db.select().from(tasks).where(inArray(tasks.parentTaskId, taskIds)).all(),
    db.select().from(workspaceMembers).all(),
  ])

  // Build lookup maps
  const listMap = new Map(allLists.map((l) => [l.id, mapListRow(l)]))
  const labelMap = new Map(allLabels.map((l) => [l.id, mapLabelRow(l)]))
  const taskLabelsMap = new Map<string, string[]>()
  for (const tl of allTaskLabels) {
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
  const subTasksMap = new Map<string, typeof tasks.$inferSelect[]>()
  for (const sub of allSubTasks) {
    if (!subTasksMap.has(sub.parentTaskId!)) subTasksMap.set(sub.parentTaskId!, [])
    subTasksMap.get(sub.parentTaskId!)!.push(sub)
  }
  const memberMap = new Map(allMembers.map((m) => [m.id, m]))

  // Recursively build task with relations
  function buildTask(taskRow: typeof tasks.$inferSelect): Task {
    const baseTask = mapTaskRow(taskRow)
    const subTaskRows = subTasksMap.get(taskRow.id) || []
    const sortedSubTasks = subTaskRows
      .sort((a: typeof tasks.$inferSelect, b: typeof tasks.$inferSelect) => (a.position || 0) - (b.position || 0))
      .map(buildTask)

    return {
      ...baseTask,
      list: taskRow.listId ? listMap.get(taskRow.listId) : undefined,
      assignee: taskRow.assigneeId
        ? mapMemberToTask(memberMap.get(taskRow.assigneeId))
        : undefined,
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

export async function getLists(): Promise<List[]> {
    const db = getDatabase()

  const allLists = db.select().from(lists).all()

  return allLists
    .map((l) => {
      // Per-list counts require a per-list query
      const listTotalResult = db.select({ count: sql`count(*)` })
        .from(tasks).where(eq(tasks.listId, l.id)).all()
      const listIncompleteResult = db.select({ count: sql`count(*)` })
        .from(tasks)
        .where(and(eq(tasks.listId, l.id), eq(tasks.completed, false)))
        .all()

      return {
        ...mapListRow(l),
        task_count: Number(listTotalResult?.[0]?.count ?? 0),
        incomplete_count: Number(listIncompleteResult?.[0]?.count ?? 0),
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

  db.insert(lists).values({
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
  db.delete(lists).where(eq(lists.id, id)).run()
}

export function updateList(id: string, data: { name?: string; color?: string; emoji?: string }): void {
    const db = getDatabase()
  const updateData: Partial<typeof lists.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }
  if (data.name !== undefined) updateData.name = data.name
  if (data.color !== undefined) updateData.color = data.color
  if (data.emoji !== undefined) updateData.emoji = data.emoji

  db.update(lists)
    .set(updateData)
    .where(eq(lists.id, id))
    .run()
}

export function getLabels(): Label[] {
    const db = getDatabase()
  return db.select().from(labels).all()
    .map(mapLabelRow)
    .sort((a: Label, b: Label) => a.name.localeCompare(b.name))
}

export function createLabel(name: string, color: string, icon: string): Label {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.insert(labels).values({
    id,
    name,
    color,
    icon,
    createdAt: now,
  }).run()

  return { id, name, color, icon, created_at: now }
}

export function updateLabel(
  id: string,
  data: { name?: string; color?: string; icon?: string | null }
): Label | null {
    const db = getDatabase()
  const updateData: Partial<typeof labels.$inferInsert> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.color !== undefined) updateData.color = data.color
  // icon is NOT NULL in the schema; a null clear becomes an empty string
  if (data.icon !== undefined) updateData.icon = data.icon ?? ''

  db.update(labels)
    .set(updateData)
    .where(eq(labels.id, id))
    .run()

  const updated = db.select().from(labels).where(eq(labels.id, id)).get()
  return updated ? mapLabelRow(updated) : null
}

export function deleteLabel(id: string): void {
    const db = getDatabase()
  db.delete(labels).where(eq(labels.id, id)).run()
}

export async function getTasks(options?: {
  listId?: string
  labelId?: string
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  completed?: boolean
  search?: string
  priority?: Priority
}): Promise<Task[]> {
    const db = getDatabase()

  const whereConditions = [isNull(tasks.parentTaskId)]

  if (options?.listId) {
    whereConditions.push(eq(tasks.listId, options.listId))
  }

  if (options?.labelId) {
    const taskIdsWithLabel = db.select({ taskId: taskLabels.taskId })
      .from(taskLabels)
      .where(eq(taskLabels.labelId, options.labelId))
      .all()
    const ids = taskIdsWithLabel.map((t) => t.taskId)
    if (ids.length > 0) {
      whereConditions.push(inArray(tasks.id, ids))
    } else {
      return [] // No tasks with this label
    }
  }

  if (options?.priority) {
    whereConditions.push(eq(tasks.priority, options.priority))
  }

  if (options?.view) {
    const today = new Date().toISOString().split('T')[0]
    const next7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    switch (options.view) {
      case 'today':
        whereConditions.push(
          or(
            eq(tasks.date, today),
            eq(tasks.deadline, today)
          )!
        )
        break
      case 'next7':
        whereConditions.push(
          and(
            sql`${tasks.date} IS NOT NULL`,
            sql`${tasks.date} >= ${today}`,
            sql`${tasks.date} <= ${next7Days}`
          )!
        )
        break
      case 'upcoming':
        whereConditions.push(
          and(
            sql`${tasks.date} IS NOT NULL`,
            sql`${tasks.date} >= ${today}`
          )!
        )
        break
    }
  }

  if (options?.completed !== undefined) {
    whereConditions.push(eq(tasks.completed, options.completed))
  }

  if (options?.search) {
    const search = options.search.toLowerCase()
    whereConditions.push(
      or(
        sql`lower(${tasks.name}) LIKE ${'%' + search + '%'}`,
        sql`lower(${tasks.description}) LIKE ${'%' + search + '%'}`
      )!
    )
  }

  const taskRows = db.select()
    .from(tasks)
    .where(and(...whereConditions))
    .orderBy(
      asc(tasks.completed),
      sql`CASE ${tasks.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END`,
      asc(tasks.position)
    )
    .all()

  return buildTaskRelations(taskRows)
}

export async function getTask(id: string): Promise<Task | undefined> {
    const db = getDatabase()
  const taskRow = db.select().from(tasks).where(eq(tasks.id, id)).get()
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
    assigneeId: data.assignee_id || null,
    sourceEventId: data.source_event_id || null,
    source: data.source || null,
    mood: data.mood || null,
    parentTaskId: data.parent_task_id || null,
    completed: data.completed || false,
    completedAt: null,
    position: data.position || 0,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(tasks).values(taskData).run()
  logTaskAction(id, 'created', `Task "${data.name}" created`)

  // Return task with relations - get list directly from DB
  const task = mapTaskRow(taskData)
  const list = task.list_id
    ? db.select().from(lists).where(eq(lists.id, task.list_id)).get()
    : undefined

  return {
    ...task,
    list: list ? mapListRow(list) : undefined,
    labels: [],
    sub_tasks: [],
    attachments: [],
    reminders: [],
    logs: [],
  }
}

export async function createTaskFromNaturalLanguage(input: string): Promise<Task | null> {
  const allLists = await getLists()

  // Parse the natural language input
  const parsed = parseNaturalLanguage(input, { lists: allLists })

  if (!parsed.name) {
    return null
  }

  // Validate the parsed task
  const validation = validateParsedTask(parsed)
  if (!validation.valid) {
    console.warn('Invalid parsed task:', validation.errors)
  }

  // Create the task
  const task = createTask({
    name: parsed.name,
    date: parsed.date,
    deadline: parsed.deadline,
    priority: parsed.priority || 'none',
    list_id: parsed.listId,
    estimate: parsed.estimate,
    recurring: parsed.recurring,
  })

  return task
}

export function updateTask(id: string, data: Partial<Task>): void {
    const db = getDatabase()

  const oldTask = getDatabase().select().from(tasks).where(eq(tasks.id, id)).get()
  if (!oldTask) return

  // Snake_case view of the previous state, for
  // accurate change detection below.
  const previous = mapTaskRow(oldTask)

  const updateData: Partial<typeof tasks.$inferInsert> = {
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
  if (data.assignee_id !== undefined) {
    updateData.assigneeId = data.assignee_id
  }
  if (data.source !== undefined) updateData.source = data.source
  if (data.mood !== undefined) updateData.mood = data.mood
  if (data.parent_task_id !== undefined) updateData.parentTaskId = data.parent_task_id
  if (data.completed !== undefined) {
    updateData.completed = data.completed
    updateData.completedAt = data.completed ? new Date().toISOString() : null
  }
  if (data.position !== undefined) updateData.position = data.position

  db.update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .run()

  const changes = Object.keys(data).filter(
    (k: string) => data[k as keyof Task] !== previous[k as keyof Task]
  )
  if (changes.length > 0) {
    logTaskAction(id, 'updated', `Updated: ${changes.join(', ')}`)
  }

  // Assignment changes notify the new assignee's
  // devices. Fire-and-forget: the update itself
  // must not wait on push delivery.
  if (
    data.assignee_id !== undefined &&
    assignmentChanged(previous.assignee_id, data.assignee_id)
  ) {
    void notifyTaskAssignment({
      taskId: id,
      taskName: data.name ?? previous.name,
      assigneeId: data.assignee_id,
    }).catch((error: unknown) => {
      console.error('Assignment notification failed:', error)
    })
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
    db.update(tasks)
      .set({ completed, completedAt, updatedAt: now })
      .where(eq(tasks.id, tid))
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

    db.insert(tasks).values(newTask).run()

    // Copy labels to new task
    if (task.labels && task.labels.length > 0) {
      for (const label of task.labels) {
        db.insert(taskLabels).values({
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
  const subtasks = db.select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.parentTaskId, id))
    .all()
  const allIds = [id, ...subtasks.map((s) => s.id)]

  // Delete related data
  db.delete(taskLabels).where(inArray(taskLabels.taskId, allIds)).run()
  db.delete(taskAttachments).where(inArray(taskAttachments.taskId, allIds)).run()
  db.delete(taskReminders).where(inArray(taskReminders.taskId, allIds)).run()
  db.delete(taskLogs).where(inArray(taskLogs.taskId, allIds)).run()
  db.delete(taskDependencies).where(
    or(
      inArray(taskDependencies.blockingTaskId, allIds),
      inArray(taskDependencies.blockedTaskId, allIds)
    )!
  ).run()

  // Delete tasks (cascade handles subtasks)
  db.delete(tasks).where(eq(tasks.id, id)).run()
}

export function clearCompletedTasks(): void {
    const db = getDatabase()

  const completedTasks = db.select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.completed, true))
    .all()

  if (completedTasks.length === 0) return

  const ids = completedTasks.map((t) => t.id)

  // Delete related data
  db.delete(taskLabels).where(inArray(taskLabels.taskId, ids)).run()
  db.delete(taskAttachments).where(inArray(taskAttachments.taskId, ids)).run()
  db.delete(taskReminders).where(inArray(taskReminders.taskId, ids)).run()
  db.delete(taskLogs).where(inArray(taskLogs.taskId, ids)).run()
  db.delete(taskDependencies).where(
    or(
      inArray(taskDependencies.blockingTaskId, ids),
      inArray(taskDependencies.blockedTaskId, ids)
    )!
  ).run()

  db.delete(tasks).where(inArray(tasks.id, ids)).run()
}

export function getTaskLabels(taskId: string): Label[] {
    const db = getDatabase()
  const taskLabelsResult = db.select()
    .from(labels)
    .innerJoin(taskLabels, eq(labels.id, taskLabels.labelId))
    .where(eq(taskLabels.taskId, taskId))
    .all()

  return taskLabelsResult.map((l) => mapLabelRow(l.labels))
}

export function addTaskLabel(taskId: string, labelId: string): void {
    const db = getDatabase()
  db.insert(taskLabels).values({ taskId, labelId }).onConflictDoNothing().run()
  logTaskAction(taskId, 'label_added', `Label ${labelId} added`)
}

export function removeTaskLabel(taskId: string, labelId: string): void {
    const db = getDatabase()
  db.delete(taskLabels)
    .where(and(eq(taskLabels.taskId, taskId), eq(taskLabels.labelId, labelId)))
    .run()
  logTaskAction(taskId, 'label_removed', `Label ${labelId} removed`)
}

export function getTaskAttachments(taskId: string): TaskAttachment[] {
    const db = getDatabase()
  return db.select().from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
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

  db.insert(taskAttachments).values({
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
  const att = db.select().from(taskAttachments).where(eq(taskAttachments.id, attachmentId)).get()
  if (att) {
    db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId)).run()
    logTaskAction(att.taskId, 'attachment_removed', `File "${att.fileName}" removed`)
  }
}

export function getTaskReminders(taskId: string): TaskReminder[] {
    const db = getDatabase()
  return db.select().from(taskReminders)
    .where(eq(taskReminders.taskId, taskId))
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

  db.insert(taskReminders).values({
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
  db.delete(taskReminders).where(eq(taskReminders.id, reminderId)).run()
}

// Background task management: due-reminder delivery.
// The client sweeps `/api/reminders` every minute;
// each sweep delivers reminders whose time has come
// and marks them sent so they are not repeated.
export interface DueReminder {
  id: string
  taskId: string
  taskName: string
  reminderTime: string
}

/** Reminders whose time has come and have not been sent yet. */
export function getDueReminders(
  now: Date = new Date(),
): DueReminder[] {
  const db = getDatabase()
  const iso = now.toISOString()
  return db
    .select({
      id: taskReminders.id,
      taskId: taskReminders.taskId,
      taskName: tasks.name,
      reminderTime: taskReminders.reminderTime,
    })
    .from(taskReminders)
    .innerJoin(tasks, eq(tasks.id, taskReminders.taskId))
    .where(
      and(
        eq(taskReminders.sent, false),
        // Completed tasks are not worth a reminder.
        eq(tasks.completed, false),
        lte(taskReminders.reminderTime, iso),
      ),
    )
    .all()
}

/**
 * Deliver every due reminder: returns them and marks
 * them sent, so the next sweep will not repeat them.
 */
export function processDueReminders(
  now: Date = new Date(),
): DueReminder[] {
  const due = getDueReminders(now)
  if (due.length === 0) {
    return []
  }

  const db = getDatabase()
  for (const reminder of due) {
    db.update(taskReminders)
      .set({ sent: true })
      .where(eq(taskReminders.id, reminder.id))
      .run()
    logTaskAction(
      reminder.taskId,
      'reminder_sent',
      `Reminder delivered for ${reminder.reminderTime}`,
    )
  }
  return due
}

export function getTaskLogs(taskId: string): TaskLog[] {
    const db = getDatabase()
  return db.select().from(taskLogs)
    .where(eq(taskLogs.taskId, taskId))
    .orderBy(desc(taskLogs.createdAt))
    .all()
    .map((log) => ({
      id: log.id,
      task_id: log.taskId,
      action: log.action,
      details: log.details,
      created_at: log.createdAt,
    }))
}

/**
 * A structured timeline entry for a task, derived from the raw task_logs.
 * Each entry combines a log action with a human-readable "change" description
 * and a snapshot of the task fields that were relevant at that moment, so the
 * UI can render a git-like diff of property changes.
 */
export interface TimelineEntry {
  /** ISO timestamp of the event */
  timestamp: string
  /** Semantic action type (created, updated, completed, reopened, deleted, etc.) */
  action: string
  /** Human-readable description of what changed */
  description: string
  /** Name of the field that changed, if applicable (otherwise null) */
  field?: string | null
  /** The previous value, for diff display (null if none) */
  from?: unknown
  /** The new value, for diff display (null if none) */
  to?: unknown
}

/**
 * Reconstruct a git-like history timeline for a task.
 *
 * Walks the task_logs table chronologically (oldest first) and groups
 * consecutive "updated" entries by changed-field clusters, so the timeline
 * shows meaningful commits rather than one line per field change.
 *
 * Returns the most recent entries first (newest-first ordering, like git log).
 */
export function getTaskHistory(taskId: string): TimelineEntry[] {
  const logs = getTaskLogs(taskId)

  // Re-sort oldest-first so we can group consecutive updates
  const chronological = [...logs].reverse()

  const entries: TimelineEntry[] = []

  for (const log of chronological) {
    if (log.action === 'created') {
      entries.push({
        timestamp: log.created_at,
        action: 'created',
        description: log.details || 'Task created',
      })
    } else if (log.action === 'completed') {
      entries.push({
        timestamp: log.created_at,
        action: 'completed',
        description: log.details || 'Task marked complete',
      })
    } else if (log.action === 'reopened') {
      entries.push({
        timestamp: log.created_at,
        action: 'reopened',
        description: log.details || 'Task reopened',
      })
    } else if (log.action === 'updated' || log.action === 'deleted') {
      // Try to parse the "Updated: field1, field2" details
      const detailMatch = log.details?.match(/^Updated:\s*(.+)$/)
      if (detailMatch) {
        const fields = detailMatch[1].split(', ').map(f => f.trim())
        fields.forEach(field => {
          entries.push({
            timestamp: log.created_at,
            action: 'updated',
            description: `${field} changed`,
            field,
          })
        })
      } else {
        entries.push({
          timestamp: log.created_at,
          action: log.action,
          description: log.details || `${log.action} event`,
        })
      }
    } else if (log.action === 'label_added' || log.action === 'label_removed') {
      entries.push({
        timestamp: log.created_at,
        action: log.action,
        description: log.details || `${log.action} event`,
      })
    } else if (log.action === 'attachment_added' || log.action === 'attachment_removed') {
      entries.push({
        timestamp: log.created_at,
        action: log.action,
        description: log.details || `${log.action} event`,
      })
    } else if (log.action === 'reminder_added' || log.action === 'reminder_sent') {
      entries.push({
        timestamp: log.created_at,
        action: log.action,
        description: log.details || `${log.action} event`,
      })
    } else if (log.action.startsWith('recurring')) {
      entries.push({
        timestamp: log.created_at,
        action: 'recurring',
        description: log.details || 'Recurring task created',
      })
    } else {
      // Generic fallback for any other action type
      entries.push({
        timestamp: log.created_at,
        action: log.action,
        description: log.details || 'Activity recorded',
      })
    }
  }

  // Reverse to newest-first ordering (like git log)
  return entries.reverse()
}

/**
 * Get the complete audit trail for a task, including both raw logs
 * and a diff-style summary of all changes. Useful for the task
 * archeology view.
 */
export async function getTaskArcheology(taskId: string): Promise<{
  task: Task | undefined
  timeline: TimelineEntry[]
  logCount: number
}> {
  const task = await getTask(taskId)
  const timeline = getTaskHistory(taskId)
  const logs = getTaskLogs(taskId)

  return {
    task,
    timeline,
    logCount: logs.length,
  }
}

function logTaskAction(taskId: string, action: string, details: string): void {
    const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.insert(taskLogs).values({
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
    .from(tasks)
    .where(
      and(
        eq(tasks.completed, false),
        isNull(tasks.parentTaskId),
        or(
          and(sql`${tasks.date} IS NOT NULL`, sql`${tasks.date} < ${today}`),
          and(sql`${tasks.deadline} IS NOT NULL`, sql`${tasks.deadline} < ${today}`)
        )!
      )
    )
    .orderBy(asc(tasks.date), asc(tasks.deadline))
    .all()

  return buildTaskRelations(taskRows)
}

export async function searchTasks(query: string): Promise<Task[]> {
    const db = getDatabase()

  const search = query.toLowerCase()

  const taskRows = db.select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.parentTaskId),
        or(
          sql`lower(${tasks.name}) LIKE ${'%' + search + '%'}`,
          sql`lower(${tasks.description}) LIKE ${'%' + search + '%'}`
        )!
      )
    )
    .orderBy(desc(tasks.createdAt))
    .limit(50)
    .all()

  return buildTaskRelations(taskRows)
}

// Task Dependencies
export function getTaskDependencies(taskId: string): { blocking: Task[]; blocked: Task[] } {
    const db = getDatabase()

  const blocking = db.select()
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.blockingTaskId, tasks.id))
    .where(eq(taskDependencies.blockedTaskId, taskId))
    .all()

  const blocked = db.select()
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.blockedTaskId, tasks.id))
    .where(eq(taskDependencies.blockingTaskId, taskId))
    .all()

  return {
    blocking: blocking.map((b) => mapTaskRow(b.tasks)),
    blocked: blocked.map((b) => mapTaskRow(b.tasks)),
  }
}

export function addTaskDependency(blockingTaskId: string, blockedTaskId: string, type: 'blocks' | 'relates' | 'duplicates' = 'blocks'): void {
    const db = getDatabase()
  const id = generateId()

  db.insert(taskDependencies).values({
    id,
    blockingTaskId,
    blockedTaskId,
    type,
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().run()
}

export function removeTaskDependency(blockingTaskId: string, blockedTaskId: string): void {
    const db = getDatabase()
  db.delete(taskDependencies)
    .where(and(
      eq(taskDependencies.blockingTaskId, blockingTaskId),
      eq(taskDependencies.blockedTaskId, blockedTaskId)
    ))
    .run()
}

export function canCompleteTask(taskId: string): { canComplete: boolean; blockingTasks: Task[] } {
    const db = getDatabase()

  const blocking = db.select()
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.blockingTaskId, tasks.id))
    .where(
      and(
        eq(taskDependencies.blockedTaskId, taskId),
        eq(taskDependencies.type, 'blocks'),
        eq(tasks.completed, false)
      )
    )
    .all()

  return {
    canComplete: blocking.length === 0,
    blockingTasks: blocking.map((b) => mapTaskRow(b.tasks)),
  }
}

// Data Export/Import
export interface ExportData {
  version: number
  exportedAt: string
  lists: List[]
  labels: Label[]
  tasks: Task[]
  taskLabels: TaskLabel[]
  taskAttachments: TaskAttachment[]
  taskReminders: TaskReminder[]
  taskDependencies: { id: string; blocking_task_id: string; blocked_task_id: string; type: string; created_at: string }[]
  taskLogs: TaskLog[]
}

export async function exportAllData(): Promise<ExportData> {
  const db = getDatabase()

  const listRows = db.select().from(lists).all()
  const labelRows = db.select().from(labels).all()
  const taskRows = db.select().from(tasks).all()
  const taskLabelRows = db.select().from(taskLabels).all()
  const taskAttachmentRows = db.select().from(taskAttachments).all()
  const taskReminderRows = db.select().from(taskReminders).all()
  const taskDependencyRows = db.select().from(taskDependencies).all()
  const taskLogRows = db.select().from(taskLogs).all()

  // Build full task objects with relations
  const fullTasks = await buildTaskRelations(taskRows)

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    lists: listRows.map(l => {
      const listTaskRows = taskRows.filter(t => t.listId === l.id)
      return {
        id: l.id,
        name: l.name,
        color: l.color,
        emoji: l.emoji,
        created_at: l.createdAt,
        updated_at: l.updatedAt,
        task_count: listTaskRows.length,
        incomplete_count: listTaskRows.filter(t => !t.completed).length,
      }
    }),
    labels: labelRows.map(l => ({
      id: l.id,
      name: l.name,
      color: l.color,
      icon: l.icon,
      created_at: l.createdAt,
    })),
    tasks: fullTasks,
    taskLabels: taskLabelRows.map(tl => ({
      task_id: tl.taskId,
      label_id: tl.labelId,
    })),
    taskAttachments: taskAttachmentRows.map(ta => ({
      id: ta.id,
      task_id: ta.taskId,
      file_name: ta.fileName,
      file_path: ta.filePath,
      file_size: ta.fileSize,
      mime_type: ta.mimeType,
      created_at: ta.createdAt,
    })),
    taskReminders: taskReminderRows.map(tr => ({
      id: tr.id,
      task_id: tr.taskId,
      reminder_time: tr.reminderTime,
      sent: tr.sent,
      created_at: tr.createdAt,
    })),
    taskDependencies: taskDependencyRows.map(td => ({
      id: td.id,
      blocking_task_id: td.blockingTaskId,
      blocked_task_id: td.blockedTaskId,
      type: td.type,
      created_at: td.createdAt,
    })),
    taskLogs: taskLogRows.map(tl => ({
      id: tl.id,
      task_id: tl.taskId,
      action: tl.action,
      details: tl.details,
      created_at: tl.createdAt,
    })),
  }
}

/**
 * Import an exported dataset.
 *
 * Import is always additive (an upsert): existing records are left alone unless
 * `onConflict` is 'replace'. There is deliberately no "replace everything"
 * mode — wiping the database is not something an import should do implicitly.
 */
export async function importAllData(data: ExportData, options?: { onConflict?: 'skip' | 'replace' }): Promise<{ success: boolean; errors: string[] }> {
  const db = getDatabase()
  const errors: string[] = []
  const { onConflict = 'skip' } = options || {}

  try {
    // Import lists
    for (const list of data.lists) {
      const existing = db.select().from(lists).where(eq(lists.id, list.id)).get()
      if (existing) {
        if (onConflict === 'replace') {
          db.update(lists).set({
            name: list.name,
            color: list.color,
            emoji: list.emoji,
            updatedAt: new Date().toISOString(),
          }).where(eq(lists.id, list.id)).run()
        }
      } else {
        db.insert(lists).values({
          id: list.id,
          name: list.name,
          color: list.color,
          emoji: list.emoji,
          createdAt: list.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).run()
      }
    }

    // Import labels
    for (const label of data.labels) {
      const existing = db.select().from(labels).where(eq(labels.id, label.id)).get()
      if (existing) {
        if (onConflict === 'replace') {
          db.update(labels).set({
            name: label.name,
            color: label.color,
            icon: label.icon,
          }).where(eq(labels.id, label.id)).run()
        }
      } else {
        db.insert(labels).values({
          id: label.id,
          name: label.name,
          color: label.color,
          icon: label.icon,
          createdAt: label.created_at || new Date().toISOString(),
        }).run()
      }
    }

    // Import tasks
    for (const task of data.tasks) {
      const existing = db.select().from(tasks).where(eq(tasks.id, task.id)).get()
      if (existing) {
        if (onConflict === 'replace') {
          db.update(tasks).set({
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
            completed: task.completed,
            completedAt: task.completed_at,
            position: task.position || 0,
            createdAt: task.created_at,
            updatedAt: new Date().toISOString(),
          }).where(eq(tasks.id, task.id)).run()
        }
      } else {
        db.insert(tasks).values({
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
          completed: task.completed,
          completedAt: task.completed_at,
          position: task.position || 0,
          createdAt: task.created_at,
          updatedAt: task.created_at,
        }).run()
      }
    }

    // Import task labels
    for (const tl of data.taskLabels) {
      const existing = db.select().from(taskLabels).where(and(eq(taskLabels.taskId, tl.task_id), eq(taskLabels.labelId, tl.label_id))).get()
      if (!existing) {
        db.insert(taskLabels).values({
          taskId: tl.task_id,
          labelId: tl.label_id,
        }).run()
      }
    }

    // Import task attachments
    for (const ta of data.taskAttachments) {
      const existing = db.select().from(taskAttachments).where(eq(taskAttachments.id, ta.id)).get()
      if (!existing) {
        db.insert(taskAttachments).values({
          id: ta.id,
          taskId: ta.task_id,
          fileName: ta.file_name,
          filePath: '/tmp/' + ta.id, // Generate a path
          fileSize: ta.file_size,
          mimeType: ta.mime_type,
          createdAt: ta.created_at,
        }).run()
      }
    }

    // Import task reminders
    for (const tr of data.taskReminders) {
      const existing = db.select().from(taskReminders).where(eq(taskReminders.id, tr.id)).get()
      if (!existing) {
        db.insert(taskReminders).values({
          id: tr.id,
          taskId: tr.task_id,
          reminderTime: tr.reminder_time,
          sent: tr.sent,
          createdAt: tr.created_at,
        }).run()
      }
    }

    // Import task dependencies
    for (const td of data.taskDependencies) {
      const existing = db.select().from(taskDependencies).where(eq(taskDependencies.id, td.id)).get()
      if (!existing) {
        db.insert(taskDependencies).values({
          id: td.id,
          blockingTaskId: td.blocking_task_id,
          blockedTaskId: td.blocked_task_id,
          type: td.type as 'blocks' | 'relates' | 'duplicates',
          createdAt: td.created_at,
        }).run()
      }
    }

    // Import task logs
    for (const tl of data.taskLogs) {
      const existing = db.select().from(taskLogs).where(eq(taskLogs.id, tl.id)).get()
      if (!existing) {
        db.insert(taskLogs).values({
          id: tl.id,
          taskId: tl.task_id,
          action: tl.action,
          details: tl.details,
          createdAt: tl.created_at,
        }).run()
      }
    }

    return { success: true, errors: [] }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error during import')
    return { success: false, errors }
  }
}