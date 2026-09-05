/**
 * CalDAV client tests.
 *
 * Tests the XML parser and iCalendar parsing logic without
 * hitting any real CalDAV server — fetch is mocked to return
 * fixture strings.
 */

import { CaldavClient, getCaldavEndpoint, caldavEventToTask } from '@/lib/caldav'

// Mock global fetch
const originalFetch = global.fetch
global.fetch = jest.fn() as jest.Mock

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset()
})

afterAll(() => {
  global.fetch = originalFetch
})

describe('getCaldavEndpoint', () => {
  it('returns the correct URL for known providers', () => {
    expect(getCaldavEndpoint('icloud')).toBe('https://caldav.icloud.com/')
    expect(getCaldavEndpoint('google')).toBe('https://apidata.googleusercontent.com/caldav/')
    expect(getCaldavEndpoint('fastmail')).toBe('https://www.fastmail.com/dav/')
  })
})

describe('CaldavClient — parsing via listCalendars/getEvents', () => {
  it('listCalendars parses a PROPFIND multistatus response', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/calendars/user/personal/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Personal</D:displayname>
        <C:calendar-color>#6366f1</C:calendar-color>
      </D:prop>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/calendars/user/work/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Work</D:displayname>
        <C:calendar-color>#ef4444</C:calendar-color>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`

    const client = new CaldavClient({
      baseUrl: 'https://caldav.icloud.com/',
      username: 'test@example.com',
      password: 'app-password',
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => xml,
    })

    const calendars = await client.listCalendars()
    expect(calendars).toHaveLength(2)
    expect(calendars[0].name).toBe('Personal')
    expect(calendars[0].url).toBe('/calendars/user/personal/')
    expect(calendars[0].color).toBe('#6366f1')
    expect(calendars[1].name).toBe('Work')
  })

  it('getEvents parses VEVENT components from a calendar-query response', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/calendars/user/event1.ics</D:href>
    <D:propstat>
      <D:prop>
        <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event1-uid
SUMMARY:Team Meeting
DESCRIPTION:Weekly sync
LOCATION:Conference Room A
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
END:VEVENT
END:VCALENDAR</C:calendar-data>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`

    const client = new CaldavClient({
      baseUrl: 'https://caldav.icloud.com/',
      username: 'test@example.com',
      password: 'app-password',
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => xml,
    })

    const events = await client.getEvents('/calendars/test/', '2024-01-01', '2024-01-31')
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe('Team Meeting')
    expect(events[0].description).toBe('Weekly sync')
    expect(events[0].location).toBe('Conference Room A')
    expect(events[0].start).toBe('2024-01-15T10:00:00Z')
    expect(events[0].end).toBe('2024-01-15T11:00:00Z')
  })

  it('returns empty arrays for empty responses', async () => {
    const client = new CaldavClient({
      baseUrl: 'https://caldav.icloud.com/',
      username: 'test@example.com',
      password: 'app-password',
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    })

    const calendars = await client.listCalendars()
    expect(calendars).toHaveLength(0)
  })
})

describe('caldavEventToTask', () => {
  it('converts a CalDAV event to a Task object', () => {
    const event = {
      id: 'event-123',
      uid: 'event-uid',
      summary: 'Sprint Planning',
      description: 'Plan the next sprint',
      location: 'Zoom',
      start: '2024-01-15T10:00:00Z',
      end: '2024-01-15T11:00:00Z',
      allDay: false,
    }

    const task = caldavEventToTask(event)
    expect(task.name).toBe('Sprint Planning')
    expect(task.description).toBe('Plan the next sprint')
    expect(task.deadline).toBe('2024-01-15T10:00:00Z')
    expect(task.priority).toBe('none')
    expect(task.source_event_id).toBe('event-123')
    expect(task.completed).toBe(false)
  })

  it('handles all-day events', () => {
    const event = {
      id: 'event-456',
      uid: 'event-uid-2',
      summary: 'Conference',
      start: '2024-01-20',
      end: '2024-01-20',
      allDay: true,
    }

    const task = caldavEventToTask(event)
    expect(task.name).toBe('Conference')
    expect(task.date).toBe('2024-01-20')
    expect(task.deadline).toBe('2024-01-20')
  })
})

describe('CaldavClient', () => {
  const mockClient = (baseUrl = 'https://caldav.icloud.com/') =>
    new CaldavClient({
      baseUrl,
      username: 'test@example.com',
      password: 'app-password',
    })

  it('constructs with basic auth headers', () => {
    const client = mockClient()
    // Headers are private, but we can verify construction doesn't throw
    expect(client).toBeDefined()
  })

  it('listCalendars calls PROPFIND on the base URL', async () => {
    const client = mockClient()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:response><D:href>/calendars/test/</D:href><D:propstat><D:prop><D:displayname>Test Calendar</D:displayname></D:prop></D:propstat></D:response></D:multistatus>`,
    })

    const calendars = await client.listCalendars()
    expect(calendars).toHaveLength(1)
    expect(calendars[0].name).toBe('Test Calendar')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://caldav.icloud.com/',
      expect.objectContaining({
        method: 'PROPFIND',
      })
    )
  })

  it('getEvents calls REPORT on the calendar URL', async () => {
    const client = mockClient()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"></D:multistatus>`,
    })

    const events = await client.getEvents('/calendars/test/', '2024-01-01', '2024-01-31')
    expect(events).toHaveLength(0)
    expect(global.fetch).toHaveBeenCalledWith(
      '/calendars/test/',
      expect.objectContaining({
        method: 'REPORT',
      })
    )
  })

  it('throws on 401 authentication failure', async () => {
    const client = mockClient()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    await expect(client.listCalendars()).rejects.toThrow('authentication failed')
  })

  it('throws on 403 forbidden', async () => {
    const client = mockClient()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
    })

    await expect(client.listCalendars()).rejects.toThrow('access forbidden')
  })

  it('createTodo sends PUT with iCal payload', async () => {
    const client = mockClient()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['Location', '/calendars/test/todo1.ics']]),
    })

    const location = await client.createTodo('/calendars/test/', {
      summary: 'New Task',
      description: 'A test task',
      start: '2024-02-01',
      end: '2024-02-01',
      allDay: true,
      due: '2024-02-01',
    })

    expect(location).toBe('/calendars/test/todo1.ics')
    expect(global.fetch).toHaveBeenCalledWith(
      '/calendars/test/',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('BEGIN:VTODO'),
      })
    )
  })
})
