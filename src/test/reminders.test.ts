/**
 * @jest-environment node
 *
 * The reminder sweep is DB-backed and the API
 * route builds a NextResponse.
 */
"use strict"

import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting, createTask, addTaskReminder, getDueReminders, processDueReminders, getTaskLogs } from '@/lib/tasks'
import { GET as sweepReminders } from '@/app/api/reminders/route'

setDbInstanceForTesting(testDb)

const PAST = new Date(Date.now() - 60_000).toISOString()
const FUTURE = new Date(Date.now() + 3_600_000).toISOString()

async function seedTask(name: 'Write report' | 'Done task' = 'Write report', completed = false) {
  const task = await createTask({ name, completed })
  return task
}

beforeAll(() => {
  runTestMigrations()
  initializeTestDatabase()
})

beforeEach(() => {
  clearTestDatabase()
})

describe('getDueReminders', () => {
  it('returns past unsent reminders', async () => {
    const task = await seedTask()
    addTaskReminder(task.id, PAST)

    const due = getDueReminders()

    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({
      taskId: task.id,
      taskName: 'Write report',
      reminderTime: PAST,
    })
  })

  it('excludes reminders that are not due yet', async () => {
    const task = await seedTask()
    addTaskReminder(task.id, FUTURE)

    expect(getDueReminders()).toHaveLength(0)
  })

  it('excludes reminders for completed tasks', async () => {
    const task = await seedTask('Done task', true)
    addTaskReminder(task.id, PAST)

    expect(getDueReminders()).toHaveLength(0)
  })

  it('excludes reminders that were already sent', async () => {
    const task = await seedTask()
    addTaskReminder(task.id, PAST)
    processDueReminders()

    expect(getDueReminders()).toHaveLength(0)
  })
})

describe('processDueReminders', () => {
  it('delivers due reminders exactly once', async () => {
    const task = await seedTask()
    addTaskReminder(task.id, PAST)

    const first = processDueReminders()
    expect(first).toHaveLength(1)
    expect(first[0].taskId).toBe(task.id)

    // The second sweep must not repeat the reminder.
    expect(processDueReminders()).toHaveLength(0)
  })

  it('logs the delivery in the task log', async () => {
    const task = await seedTask()
    addTaskReminder(task.id, PAST)
    processDueReminders()

    const logs = getTaskLogs(task.id)
    expect(
      logs.some(
        (log) =>
          log.action === 'reminder_sent' &&
          log.details?.includes(PAST),
      )
    ).toBe(true)
  })

  it('returns nothing when no reminders are due', () => {
    expect(processDueReminders()).toHaveLength(0)
  })
})

describe('GET /api/reminders', () => {
  it('delivers due reminders and marks them sent', async () => {
    const task = await seedTask()
    addTaskReminder(task.id, PAST)

    const response = await sweepReminders()
    const body = (await response.json()) as {
      reminders: { taskId: string; taskName: string }[]
    }

    expect(response.status).toBe(200)
    expect(body.reminders).toHaveLength(1)
    expect(body.reminders[0]).toMatchObject({
      taskId: task.id,
      taskName: 'Write report',
    })

    // Already delivered — the next sweep is empty.
    const second = await sweepReminders()
    const secondBody = (await second.json()) as {
      reminders: unknown[]
    }
    expect(secondBody.reminders).toHaveLength(0)
  })
})
