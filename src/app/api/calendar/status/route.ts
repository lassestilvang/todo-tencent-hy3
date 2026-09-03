import { NextRequest, NextResponse } from 'next/server'
import { getCalendarList } from '@/lib/calendar'
import { getValidAccessToken, applyTokensCookie } from '@/lib/calendar/tokens'

export async function GET(request: NextRequest) {
  const auth = await getValidAccessToken(request)

  if (!auth) {
    return NextResponse.json({ connected: false })
  }

  try {
    const calendars = await getCalendarList(auth.accessToken)
    const selectedCalendar = request.cookies.get('calendar-selected')?.value ||
      calendars.find(c => c.primary)?.id ||
      calendars[0]?.id

    const response = NextResponse.json({
      connected: true,
      calendars,
      selectedCalendar,
      lastSync: request.cookies.get('calendar-last-sync')?.value || null,
    })
    applyTokensCookie(response, auth.cookieValue)
    return response
  } catch (error) {
    console.error('Calendar status error:', error)
    return NextResponse.json({ connected: false, error: 'Failed to fetch calendars' })
  }
}