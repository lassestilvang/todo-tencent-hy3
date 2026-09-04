/**
 * @jest-environment node
 *
 * Assignment touches server-only modules
 * (the notifier imports push-store, which
 * imports 'server-only'), so it needs the
 * Node environment.
 */
"use strict"

import {
  canAssignTask,
  assignmentChanged,
  buildAssignmentNotification,
  findMember,
} from '@/lib/collaboration/assignment'
import {
  notifyTaskAssignment,
  resetVapidConfigurationForTesting,
} from '@/lib/collaboration/notifier'
import {
  saveSubscription,
} from '@/lib/push-store'
import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/tasks'
import { setDbInstanceForTesting as setStoreDbForTesting } from '@/lib/db/instance'
import { workspaceMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { WorkspaceMember } from '@/lib/workspaces'
import webpush from 'web-push'

// The task store and the collaboration stores
// keep separate overrides; point both at the
// migrated in-memory test database.
setDbInstanceForTesting(testDb)
setStoreDbForTesting(testDb)

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}))

const pushMock = webpush as unknown as {
  setVapidDetails: jest.Mock
  sendNotification: jest.Mock
}

const VAPID_KEYS = [
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
]
const savedEnv: Record<string, string | undefined> = {}

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: 'member-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    email: 'assignee@example.com',
    name: 'Alex',
    role: 'member',
    joinedAt: Date.now(),
    ...overrides,
  }
}

describe('Assignment permissions', () => {
  it('lets owners, admins and members assign', () => {
    expect(canAssignTask('owner')).toBe(true)
    expect(canAssignTask('admin')).toBe(true)
    expect(canAssignTask('member')).toBe(true)
  })

  it('refuses viewers', () => {
    expect(canAssignTask('viewer')).toBe(false)
  })
})

describe('Assignment change detection', () => {
  it('detects assignment and clearing', () => {
    expect(assignmentChanged(null, 'member-1')).toBe(true)
    expect(assignmentChanged('member-1', null)).toBe(true)
  })

  it('treats undefined as unassigned', () => {
    expect(assignmentChanged(undefined, null)).toBe(false)
    expect(assignmentChanged(undefined, 'member-1')).toBe(true)
  })

  it('ignores unchanged assignments', () => {
    expect(assignmentChanged('member-1', 'member-1')).toBe(false)
    expect(assignmentChanged(null, null)).toBe(false)
  })
})

describe('Assignment notification', () => {
  const task = { id: 'task-1', name: 'Write report' }
  const assignee = { id: 'member-1', name: 'Alex' }

  it('names the assigner when known', () => {
    const notification = buildAssignmentNotification({
      task,
      assignee,
      assignerName: 'Sam',
    })

    expect(notification.title).toBe('Task assigned to you')
    expect(notification.body).toBe(
      '"Write report" was assigned to you by Sam.'
    )
    expect(notification.tag).toBe('task-assignment-task-1')
    expect(notification.data).toEqual({
      taskId: 'task-1',
      taskName: 'Write report',
      assigneeId: 'member-1',
    })
  })

  it('omits the assigner when unknown', () => {
    const notification = buildAssignmentNotification({
      task,
      assignee,
    })

    expect(notification.body).toBe(
      '"Write report" was assigned to you.'
    )
  })

  it('finds a member by id', () => {
    const roster = [member(), member({ id: 'member-2', name: 'Sam' })]

    expect(findMember(roster, 'member-2')?.name).toBe('Sam')
    expect(findMember(roster, 'missing')).toBeUndefined()
    expect(findMember(roster, null)).toBeUndefined()
  })
})

describe('Assignment delivery', () => {
  beforeAll(() => {
    for (const key of VAPID_KEYS) {
      savedEnv[key] = process.env[key]
    }
    runTestMigrations()
    initializeTestDatabase()
  })

  afterAll(() => {
    for (const key of VAPID_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
  })

  beforeEach(() => {
    clearTestDatabase()
    resetVapidConfigurationForTesting()
    pushMock.setVapidDetails.mockClear()
    pushMock.sendNotification.mockReset()

    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public-key'
    process.env.VAPID_PRIVATE_KEY = 'private-key'
  })

  afterEach(() => {
    for (const key of VAPID_KEYS) delete process.env[key]
  })

  function seedAssignee(): WorkspaceMember {
    // `workspace_members` carries no foreign key
    // to workspaces, so the roster row can be
    // seeded on its own.
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

    return member()
  }

  it('delivers to every device of the assignee', async () => {
    const assignee = seedAssignee()
    saveSubscription({
      endpoint: 'https://push.example/1',
      p256dh: 'key-1',
      auth: 'auth-1',
      userId: assignee.userId,
    })
    saveSubscription({
      endpoint: 'https://push.example/2',
      p256dh: 'key-2',
      auth: 'auth-2',
      userId: assignee.userId,
    })
    pushMock.sendNotification.mockResolvedValue(undefined)

    const delivered = await notifyTaskAssignment({
      taskId: 'task-1',
      taskName: 'Write report',
      assigneeId: assignee.id,
      assignerName: 'Sam',
    })

    expect(delivered).toBe(2)
    expect(pushMock.setVapidDetails).toHaveBeenCalledWith(
      'mailto:admin@taskflow.app',
      'public-key',
      'private-key'
    )
    expect(pushMock.sendNotification).toHaveBeenCalledTimes(2)

    const [subscription, payload] =
      pushMock.sendNotification.mock.calls[0]
    expect(subscription.endpoint).toBe(
      'https://push.example/1'
    )
    expect(JSON.parse(payload)).toEqual(
      buildAssignmentNotification({
        task: { id: 'task-1', name: 'Write report' },
        assignee: { id: assignee.id, name: 'Alex' },
        assignerName: 'Sam',
      })
    )
  })

  it('delivers nothing for an unknown member', async () => {
    const delivered = await notifyTaskAssignment({
      taskId: 'task-1',
      taskName: 'Write report',
      assigneeId: 'missing-member',
    })

    expect(delivered).toBe(0)
    expect(pushMock.sendNotification).not.toHaveBeenCalled()
  })

  it('delivers nothing when unassigned', async () => {
    const delivered = await notifyTaskAssignment({
      taskId: 'task-1',
      taskName: 'Write report',
      assigneeId: null,
    })

    expect(delivered).toBe(0)
  })

  it('delivers nothing without subscriptions', async () => {
    seedAssignee()

    const delivered = await notifyTaskAssignment({
      taskId: 'task-1',
      taskName: 'Write report',
      assigneeId: 'member-1',
    })

    expect(delivered).toBe(0)
    expect(pushMock.sendNotification).not.toHaveBeenCalled()
  })

  it('skips delivery when VAPID is not configured', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    const assignee = seedAssignee()
    saveSubscription({
      endpoint: 'https://push.example/1',
      p256dh: 'key-1',
      auth: 'auth-1',
      userId: assignee.userId,
    })

    const delivered = await notifyTaskAssignment({
      taskId: 'task-1',
      taskName: 'Write report',
      assigneeId: assignee.id,
    })

    expect(delivered).toBe(0)
    expect(pushMock.sendNotification).not.toHaveBeenCalled()
  })

  it('counts only the deliveries that succeed', async () => {
    const assignee = seedAssignee()
    saveSubscription({
      endpoint: 'https://push.example/1',
      p256dh: 'key-1',
      auth: 'auth-1',
      userId: assignee.userId,
    })
    saveSubscription({
      endpoint: 'https://push.example/2',
      p256dh: 'key-2',
      auth: 'auth-2',
      userId: assignee.userId,
    })

    // The first device rejects (e.g. an expired
    // subscription); the second still gets the
    // message.
    pushMock.sendNotification
      .mockRejectedValueOnce(new Error('expired'))
      .mockResolvedValueOnce(undefined)

    const delivered = await notifyTaskAssignment({
      taskId: 'task-1',
      taskName: 'Write report',
      assigneeId: assignee.id,
    })

    expect(delivered).toBe(1)
  })

  it('reads the assignee straight from the member table', () => {
    // The notifier resolves members by id without
    // going through the workspace roster API.
    const assignee = seedAssignee()
    const row = testDb
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.id, assignee.id))
      .get()

    expect(row?.name).toBe('Alex')
  })
})
