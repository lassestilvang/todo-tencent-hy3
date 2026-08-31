import { NextRequest, NextResponse } from 'next/server'
import { getCalendarList, getEvents, createEvent, taskToCalendarEvent } from '@/lib/calendar'
import { getTasks } from '@/lib/tasks'

async function getAccessToken(request: NextRequest): Promise<string | null> {
  const tokenCookie = request.cookies.get('google_calendar_tokens')?.value
  if (!tokenCookie) return null

  try {
    const tokens = JSON.parse(tokenCookie)
    if (Date.now() >= tokens.expires_at) {
      // Token expired, would need refresh
      return null
    }
    return tokens.access_token
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const accessToken = await getAccessToken(request)
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // Get user's calendars
    const calendars = await getCalendarList(accessToken)
    const primaryCalendar = calendars.find(c => c.primary) || calendars[0]

    if (!primaryCalendar) {
      return NextResponse.json({ error: 'No calendars found' }, { status: 404 })
    }

    // Get tasks from TaskFlow
    const tasks = await getTasks({ view: 'upcoming', completed: false })

    // Sync tasks to calendar
    const timeMin = new Date().toISOString()
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days

    const { items: existingEvents } = await getEvents(
      accessToken,
      primaryCalendar.id,
      timeMin,
      timeMax
    )

    // Build map of existing events by task ID
    const eventMap = new Map<string, string>()
    for (const event of existingEvents) {
      if (event.id.startsWith('task-')) {
        const taskId = event.id.replace('task-', '')
        eventMap.set(taskId, event.id)
      }
    }

    let synced = 0
    const errors: string[] = []

    for (const task of tasks) {
      try {
        const event = taskToCalendarEvent(task)
        const existingEventId = eventMap.get(task.id)

        if (existingEventId) {
          // Update existing event
          await createEvent(accessToken, primaryCalendar.id, event)
        } else {
          // Create new event
          await createEvent(accessToken, primaryCalendar.id, event)
        }
        synced++
      } catch (error) {
        errors.push(`Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      errors,
      lastSync: new Date().toISOString(),
      calendar: primaryCalendar.summary,
    })
  } catch (error) {
    console.error('Calendar sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Manual sync trigger
  return GET(request)
}