/**
 * @jest-environment node
 *
 * The task store's assignment integration:
 * assignee round-trips and the notification
 * side effect of `updateTask`.
 */
"use strict"

import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/tasks'
import { setDbInstanceForTesting as setStoreDbForTesting } from '@/lib/db/instance'
import { workspaceMembers } from '@/lib/db/schema'

// The notifier is mocked out: these tests
// assert when it is invoked, not how it
// delivers.
jest.mock('@/lib/collaboration/notifier', () => ({
  notifyTaskAssignment: jest.fn(),
  resetVapidConfigurationForTesting: jest.fn(),
}))

import { createTask, updateTask, getTask } from '@/lib/tasks'
import { notifyTaskAssignment } from '@/lib/collaboration/notifier'
import { eq } from 'drizzle-orm'

const notifyMock = notifyTaskAssignment as jest.Mock

setDbInstanceForTesting(testDb)
setStoreDbForTesting(testDb)

describe('Task assignment store integration', () => {
  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
    // updateTask fires the notification
    // fire-and-forget, so the mock must
    // return a thenable.
    notifyMock.mockClear()
    notifyMock.mockResolvedValue(0)

    testDb
      .insert(workspaceMembers)
      .values({
        id: 'member-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        email: 'assignee@example.com',
        name: 'Alex',
        role: 'member',
        joinedAt: Date.now(),
      })
      .run()
  })

  it('creates a task with an assignee', () => {
    const task = createTask({
      name: 'Write report',
      assignee_id: 'member-1',
      list_id: 'inbox',
    })

    expect(task.assignee_id).toBe('member-1')
  })

  it('resolves the assignee on read', async () => {
    const created = createTask({
      name: 'Write report',
      assignee_id: 'member-1',
      list_id: 'inbox',
    })

    const task = await getTask(created.id)

    expect(task?.assignee?.id).toBe('member-1')
    expect(task?.assignee?.name).toBe('Alex')
    expect(task?.assignee?.email).toBe(
      'assignee@example.com'
    )
  })

  it('leaves the assignee undefined when unassigned', async () => {
    const created = createTask({
      name: 'Write report',
      list_id: 'inbox',
    })

    const task = await getTask(created.id)

    expect(task?.assignee_id).toBeNull()
    expect(task?.assignee).toBeUndefined()
  })

  it('notifies the assignee when the assignment changes', () => {
    const created = createTask({
      name: 'Write report',
      list_id: 'inbox',
    })

    updateTask(created.id, { assignee_id: 'member-1' })

    expect(notifyMock).toHaveBeenCalledWith({
      taskId: created.id,
      taskName: 'Write report',
      assigneeId: 'member-1',
    })

    const task = testDb
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.id, 'member-1'))
      .get()
    expect(task?.name).toBe('Alex')
  })

  it('notifies when the assignment is cleared', () => {
    const created = createTask({
      name: 'Write report',
      assignee_id: 'member-1',
      list_id: 'inbox',
    })
    notifyMock.mockClear()

    updateTask(created.id, { assignee_id: null })

    expect(notifyMock).toHaveBeenCalledWith({
      taskId: created.id,
      taskName: 'Write report',
      assigneeId: null,
    })
  })

  it('does not notify when the assignment is unchanged', () => {
    const created = createTask({
      name: 'Write report',
      assignee_id: 'member-1',
      list_id: 'inbox',
    })
    notifyMock.mockClear()

    updateTask(created.id, { assignee_id: 'member-1' })

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('does not notify on unrelated updates', () => {
    const created = createTask({
      name: 'Write report',
      assignee_id: 'member-1',
      list_id: 'inbox',
    })
    notifyMock.mockClear()

    updateTask(created.id, { priority: 'high' })

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('uses the current name when the update does not rename', () => {
    const created = createTask({
      name: 'Write report',
      list_id: 'inbox',
    })

    updateTask(created.id, {
      assignee_id: 'member-1',
      priority: 'high',
    })

    expect(notifyMock).toHaveBeenCalledWith({
      taskId: created.id,
      taskName: 'Write report',
      assigneeId: 'member-1',
    })
  })

  it('logs the assignment change in the activity log', async () => {
    const created = createTask({
      name: 'Write report',
      list_id: 'inbox',
    })

    updateTask(created.id, { assignee_id: 'member-1' })

    const task = await getTask(created.id)
    const log = task?.logs?.find(
      (entry) => entry.details?.includes('assignee_id')
    )

    expect(log).toBeDefined()
    expect(log?.action).toBe('updated')
  })
})
