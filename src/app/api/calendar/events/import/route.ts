import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getEvent,
  createTaskFromEvent,
} from '@/lib/calendar'
import { getLists } from '@/lib/tasks'
import {
  getValidAccessToken,
  applyTokensCookie,
} from '@/lib/calendar/tokens'

const importSchema = z.object({
  eventId: z.string().min(1),
  calendarId: z.string().min(1),
  /** List to import into; defaults to the first list */
  listId: z.string().min(1).optional(),
})

/**
 * Import a single Google Calendar event into
 * TaskFlow as a task linked to it via
 * `source_event_id`.
 */
export async function POST(request: NextRequest) {
  const auth = await getValidAccessToken(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }
  const accessToken = auth.accessToken

  let body: z.infer<typeof importSchema>
  try {
    body = importSchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { error: 'eventId, calendarId and optional listId are required' },
      { status: 400 }
    )
  }

  try {
    let listId = body.listId
    if (!listId) {
      const lists = await getLists()
      listId = lists[0]?.id
    }

    if (!listId) {
      return NextResponse.json(
        { error: 'No list to import into' },
        { status: 404 }
      )
    }

    const event = await getEvent(
      accessToken,
      body.calendarId,
      body.eventId
    )
    const task = await createTaskFromEvent(event, listId)

    const response = NextResponse.json({ task })
    applyTokensCookie(response, auth.cookieValue)
    return response
  } catch (error) {
    console.error('Event import error:', error)
    const message =
      error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { error: 'Import failed', details: message },
      { status: 500 }
    )
  }
}
