import { NextRequest, NextResponse } from 'next/server'
import { syncCalendar } from '@/lib/calendar/sync'
import { getValidAccessToken, applyTokensCookie } from '@/lib/calendar/tokens'

export async function GET(request: NextRequest) {
  const auth = await getValidAccessToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const accessToken = auth.accessToken

  const { searchParams } = new URL(request.url)
  // Import Google events that are not yet in TaskFlow.
  // Off by default so a plain sync stays push-only (backward compatible).
  const shouldPull = searchParams.get('pull') === 'true'
  const listId = searchParams.get('listId')
  const conflictStrategyParam = searchParams.get('conflictStrategy')
  const conflictStrategy =
    conflictStrategyParam === 'task' ||
    conflictStrategyParam === 'calendar' ||
    conflictStrategyParam === 'newest'
      ? conflictStrategyParam
      : undefined

  try {
    const result = await syncCalendar(accessToken, {
      pull: shouldPull,
      listId,
      conflictStrategy,
    })

    const response = NextResponse.json(result)
    applyTokensCookie(response, auth.cookieValue)
    return response
  } catch (error) {
    console.error('Calendar sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message === 'No calendars found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Sync failed', details: message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Manual sync trigger
  return GET(request)
}
