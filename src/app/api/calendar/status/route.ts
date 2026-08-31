import { NextRequest, NextResponse } from 'next/server'
import { getCalendarList } from '@/lib/calendar'

async function getAccessToken(request: NextRequest): Promise<string | null> {
  const tokenCookie = request.cookies.get('google_calendar_tokens')?.value
  if (!tokenCookie) return null

  try {
    const tokens = JSON.parse(tokenCookie)
    if (Date.now() >= tokens.expires_at) {
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
    return NextResponse.json({ connected: false })
  }

  try {
    const calendars = await getCalendarList(accessToken)
    const selectedCalendar = request.cookies.get('calendar-selected')?.value ||
      calendars.find(c => c.primary)?.id ||
      calendars[0]?.id

    return NextResponse.json({
      connected: true,
      calendars,
      selectedCalendar,
      lastSync: request.cookies.get('calendar-last-sync')?.value || null,
    })
  } catch (error) {
    console.error('Calendar status error:', error)
    return NextResponse.json({ connected: false, error: 'Failed to fetch calendars' })
  }
}