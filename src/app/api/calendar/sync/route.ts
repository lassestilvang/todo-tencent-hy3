import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CaldavClient, getCaldavEndpoint, CalDAVEvent, caldavEventToTask } from '@/lib/caldav'
import { createTask, getTasks } from '@/lib/tasks'

// POST /api/calendar/sync — sync events from an external calendar
//
// Body:
//   {
//     "provider": "icloud" | "google" | "fastmail",
//     "baseUrl": "https://caldav.icloud.com/...",
//     "username": "user@icloud.com",
//     "password": "app-specific-password",
//     "daysAhead": 7
//   }
//
// Returns: { synced: number, tasks: Task[] }

const syncBodySchema = z.object({
  provider: z.enum(['icloud', 'google', 'fastmail']).optional(),
  baseUrl: z.string().url().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  daysAhead: z.number().min(1).max(90).default(7),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = syncBodySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { provider, baseUrl, username, password, daysAhead } = parsed.data

  try {
    const caldavUrl = baseUrl || (provider ? getCaldavEndpoint(provider) : undefined)
    if (!caldavUrl) {
      return NextResponse.json(
        { error: 'Must provide baseUrl or provider' },
        { status: 400 },
      )
    }

    const caldav = new CaldavClient({
      baseUrl: caldavUrl,
      username,
      password,
    })

    // Discover calendars
    const calendars = await caldav.listCalendars()
    if (calendars.length === 0) {
      return NextResponse.json(
        { error: 'No calendars found for this account' },
        { status: 400 },
      )
    }

    const start = new Date().toISOString().split('T')[0]
    const end = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Fetch events from all calendars
    const allEvents: CalDAVEvent[] = []
    for (const cal of calendars) {
      try {
        const events = await caldav.getEvents(cal.url, start, end)
        allEvents.push(...events)
      } catch (err) {
        console.warn(`Failed to fetch from calendar "${cal.name}":`, err)
      }
    }

    // Create TaskFlow tasks for events that don't already exist
    // Skip events that are marked as all-day with no summary (likely empty)
    const existingTasks = await getTasks({ view: 'all' })
    const existingEventIds = new Set(
      existingTasks
        .filter((t) => t.source_event_id)
        .map((t) => t.source_event_id),
    )

    let synced = 0
    const createdTasks = []

    for (const event of allEvents) {
      if (existingEventIds.has(event.id)) continue

      const taskData = caldavEventToTask(event)
      const newTask = await createTask({
        ...taskData,
        name: `📅 ${taskData.name}`, // Prefix to distinguish calendar imports
      })
      createdTasks.push(newTask)
      synced++
    }

    return NextResponse.json({
      synced,
      tasks: createdTasks,
      calendars: calendars.length,
      eventsTotal: allEvents.length,
    })
  } catch (err: any) {
    console.error('CalDAV sync error:', err)
    return NextResponse.json(
      { error: err.message || 'CalDAV sync failed' },
      { status: 500 },
    )
  }
}
