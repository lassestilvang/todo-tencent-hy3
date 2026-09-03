import type { Priority } from '@/types'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string
  attendees?: { email: string; displayName?: string }[]
  reminders?: {
    useDefault: boolean
    overrides?: { method: 'email' | 'popup'; minutes: number }[]
  }
  recurrence?: string[]
  htmlLink?: string
  created?: string
  updated?: string
}

export interface CalendarListEntry {
  id: string
  summary: string
  description?: string
  primary?: boolean
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader'
  backgroundColor?: string
  foregroundColor?: string
  selected?: boolean
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: 'Bearer'
  scope: string
}

export interface CalendarSyncResult {
  success: boolean
  synced: number
  errors: string[]
  lastSync: string
}

const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  return response.json()
}

export async function getCalendarList(accessToken: string): Promise<CalendarListEntry[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch calendar list')
  }

  const data = await response.json()
  return data.items || []
}

export async function getEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  syncToken?: string
): Promise<{ items: CalendarEvent[]; nextSyncToken?: string }> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  if (syncToken) {
    params.set('syncToken', syncToken)
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    if (response.status === 410 && syncToken) {
      // Sync token expired, need full sync
      return getEvents(accessToken, calendarId, timeMin, timeMax)
    }
    throw new Error('Failed to fetch events')
  }

  const data = await response.json()
  return {
    items: data.items || [],
    nextSyncToken: data.nextSyncToken,
  }
}

export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent
): Promise<CalendarEvent> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create event: ${error}`)
  }

  return response.json()
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<CalendarEvent>
): Promise<CalendarEvent> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update event: ${error}`)
  }

  return response.json()
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete event: ${error}`)
  }
}

export function taskToCalendarEvent(task: {
  id: string
  name: string
  description?: string | null
  date?: string | null
  deadline?: string | null
  estimate?: number | null
  priority?: string
  list_id?: string | null
}): CalendarEvent {
  const startDate = task.date || task.deadline
  const endDate = task.deadline || task.date

  if (!startDate) {
    throw new Error('Task must have a date or deadline')
  }

  const start = new Date(startDate)
  const end = endDate && endDate !== startDate ? new Date(endDate) : new Date(start.getTime() + (task.estimate || 60) * 60000)

  return {
    id: `task-${task.id}`,
    summary: task.name,
    description: task.description || undefined,
    start: {
      dateTime: start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'popup', minutes: 10 },
      ],
    },
  }
}

export function calendarEventToTask(event: CalendarEvent, listId: string): {
  name: string
  description?: string
  date?: string
  deadline?: string
  estimate?: number
  priority: Priority
  list_id: string
} {
  const start = event.start.dateTime || event.start.date
  const end = event.end.dateTime || event.end.date

  const startDate = start ? new Date(start) : new Date()
  const endDate = end ? new Date(end) : new Date(startDate.getTime() + 60 * 60000)

  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)

  return {
    name: event.summary,
    description: event.description,
    date: startDate.toISOString().split('T')[0],
    deadline: endDate.toISOString().split('T')[0],
    estimate: Math.max(durationMinutes, 15),
    priority: 'medium',
    list_id: listId,
  }
}