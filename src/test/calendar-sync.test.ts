import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/tasks'

// Set up test database before importing the sync orchestration
// (which pulls tasks through the same store instance). The store
// reads the DB lazily, so setting it here covers the sync too.
setDbInstanceForTesting(testDb)

import { syncCalendar } from '@/lib/calendar/sync'
import { getTasks, createTask, getLists, createList } from '@/lib/tasks'

const futureDate = new Date(Date.now() + 2 * 86_400_000).toISOString()
const futureEnd = new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString()

interface SyncEvent {
  id: string
  summary: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
}

function googleEvent(id: string, summary: string): SyncEvent {
  return {
    id,
    summary,
    start: { dateTime: futureDate, timeZone: 'UTC' },
    end: { dateTime: futureEnd, timeZone: 'UTC' },
  }
}

interface FetchCall {
  url: string
  method: string
}

const jsonOk = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data),
})

describe('Calendar sync', () => {
  const originalFetch = global.fetch
  let fetchCalls: FetchCall[]
  let syncEvents: SyncEvent[]

  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
    fetchCalls = []
    syncEvents = []

    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      fetchCalls.push({ url, method })

      if (url.includes('/users/me/calendarList')) {
        return Promise.resolve(
          jsonOk({ items: [{ id: 'primary', summary: 'Primary Calendar', primary: true }] })
        )
      }
      if (url.includes('/events') && method === 'GET') {
        return Promise.resolve(jsonOk({ items: syncEvents }))
      }
      if (method === 'POST') {
        return Promise.resolve(jsonOk({ id: 'created-event' }))
      }
      if (method === 'PATCH') {
        return Promise.resolve(jsonOk({ id: 'updated-event' }))
      }
      return Promise.resolve({ ok: false, status: 404, text: async () => 'Not found' })
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('should push tasks to the calendar', async () => {
    syncEvents = []

    createTask({
      name: 'Native Task',
      date: futureDate,
      estimate: 30,
      list_id: 'inbox',
    })

    const result = await syncCalendar('access-token')

    expect(result.success).toBe(true)
    expect(result.synced).toBe(1)
    expect(result.pulled).toBe(0)
    expect(result.calendar).toBe('Primary Calendar')

    const post = fetchCalls.find(c => c.method === 'POST' && c.url.includes('/events'))
    expect(post).toBeDefined()
  })

  it('should import unlinked Google events when pull=true', async () => {
    syncEvents = [
      googleEvent('task-native', 'TaskFlow Event'),
      googleEvent('google-new', 'New Event'),
      googleEvent('google-imported', 'Already Imported'),
    ]

    // A task already linked to the "google-imported" event.
    createTask({
      name: 'Already Imported',
      date: futureDate,
      estimate: 30,
      list_id: 'inbox',
      source_event_id: 'google-imported',
    })

    const result = await syncCalendar('access-token', { pull: true })

    expect(result.pulled).toBe(1)

    const tasks = await getTasks({ view: 'upcoming', completed: false })
    const imported = tasks.find(t => t.name === 'New Event')

    expect(imported).toBeDefined()
    expect(imported!.source_event_id).toBe('google-new')

    // The already-linked event was not imported twice.
    expect(tasks.filter(t => t.name === 'Already Imported')).toHaveLength(1)
    // TaskFlow-created events are never imported.
    expect(tasks.find(t => t.name === 'TaskFlow Event')).toBeUndefined()
  })

  it('should not import events when pull is not requested', async () => {
    syncEvents = [googleEvent('google-new', 'New Event')]

    const result = await syncCalendar('access-token')

    expect(result.pulled).toBe(0)

    const tasks = await getTasks()
    expect(tasks.find(t => t.name === 'New Event')).toBeUndefined()
  })

  it('should update the source event of an imported task', async () => {
    syncEvents = [googleEvent('google-imported', 'Already Imported')]

    createTask({
      name: 'Already Imported',
      date: futureDate,
      estimate: 30,
      list_id: 'inbox',
      source_event_id: 'google-imported',
    })

    await syncCalendar('access-token')

    const patch = fetchCalls.find(
      c => c.method === 'PATCH' && c.url.includes('google-imported')
    )
    expect(patch).toBeDefined()
  })

  it('should import into the requested list', async () => {
    syncEvents = [googleEvent('google-new', 'New Event')]

    createList('Imported', '#123456', '📥')
    const lists = await getLists()
    const target = lists.find(l => l.name === 'Imported')!

    await syncCalendar('access-token', { pull: true, listId: target.id })

    const tasks = await getTasks()
    expect(tasks.find(t => t.name === 'New Event')?.list_id).toBe(target.id)
  })

  it('should import into the first list by default', async () => {
    syncEvents = [googleEvent('google-new', 'New Event')]

    const lists = await getLists()
    const firstList = lists[0]

    await syncCalendar('access-token', { pull: true })

    const tasks = await getTasks()
    expect(tasks.find(t => t.name === 'New Event')?.list_id).toBe(firstList.id)
  })

  it('should throw when no calendars exist', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/users/me/calendarList')) {
        return Promise.resolve(jsonOk({ items: [] }))
      }
      return Promise.resolve(jsonOk({ items: [] }))
    })

    await expect(syncCalendar('access-token')).rejects.toThrow('No calendars found')
  })

  it('should collect per-task errors without failing the sync', async () => {
    syncEvents = []

    const created = createTask({
      name: 'Sync Task',
      date: futureDate,
      estimate: 30,
      list_id: 'inbox',
    })

    // Event creation fails for this task.
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      fetchCalls.push({ url, method })

      if (url.includes('/users/me/calendarList')) {
        return Promise.resolve(
          jsonOk({ items: [{ id: 'primary', summary: 'Primary Calendar', primary: true }] })
        )
      }
      if (url.includes('/events') && method === 'GET') {
        return Promise.resolve(jsonOk({ items: syncEvents }))
      }
      if (method === 'POST' || method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        })
      }
      return Promise.resolve({ ok: false, status: 404, text: async () => 'Not found' })
    })

    const result = await syncCalendar('access-token')

    expect(result.success).toBe(true)
    expect(result.synced).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain(created.id)
    expect(result.errors[0]).toContain('Failed to create event')
  })

  it('should report diverged task/event pairs as conflicts', async () => {
    const created = createTask({
      name: 'Old name',
      date: futureDate,
    })
    // A diverged event linked through the
    // `task-{id}` convention.
    syncEvents = [googleEvent(`task-${created.id}`, 'New name')]

    const result = await syncCalendar('access-token')

    expect(result.conflicts).toBe(1)
    // Without a strategy the task keeps its values.
    const afterNoStrategy = await getTasks()
    expect(
      afterNoStrategy.find((task) => task.id === created.id)?.name
    ).toBe('Old name')
  })

  it('should resolve conflicts in favor of the calendar when requested', async () => {
    const created = createTask({
      name: 'Old name',
      date: futureDate,
    })
    syncEvents = [googleEvent(`task-${created.id}`, 'New name')]

    const result = await syncCalendar('access-token', {
      conflictStrategy: 'calendar',
    })

    expect(result.conflicts).toBe(1)
    const afterCalendar = await getTasks()
    expect(
      afterCalendar.find((task) => task.id === created.id)?.name
    ).toBe('New name')
  })

  it('should resolve conflicts in favor of the task by default push', async () => {
    const created = createTask({
      name: 'TaskFlow name',
      date: futureDate,
    })
    syncEvents = [googleEvent(`task-${created.id}`, 'Calendar name')]

    const result = await syncCalendar('access-token', {
      conflictStrategy: 'task',
    })

    expect(result.conflicts).toBe(1)
    // The task won; the event was patched to match
    // it during the push (a PATCH to the event URL).
    expect(
      fetchCalls.filter(
        (call) =>
          call.method === 'PATCH' &&
          call.url.includes(`task-${created.id}`)
      ).length
    ).toBeGreaterThan(0)
    const afterTask = await getTasks()
    expect(
      afterTask.find((task) => task.id === created.id)?.name
    ).toBe('TaskFlow name')
  })
})
