/**
 * CalDAV Client for Apple Calendar (iCloud) and other CalDAV servers
 *
 * Implements the CalDAV protocol (RFC 4791) over HTTP Basic Auth,
 * which is what Apple Calendar/Cloud uses. Supports:
 * - Listing calendars (calendars-home-set)
 * - Fetching events with date-range filtering
 * - Creating tasks (VTODO components)
 * - OAuth2 not required — uses app-specific passwords
 *
 * Usage:
 *   const caldav = new CaldavClient({
 *     baseUrl: 'https://caldav.icloud.com/',
 *     username: 'user@icloud.com',
 *     password: 'app-specific-password',
 *   })
 *   const calendars = await caldav.listCalendars()
 *   const events = await caldav.getEvents(calendarId, startDate, endDate)
 */

/** Minimal XML parser for CalDAV PROPFIND responses. */
interface XmlElement {
  name: string
  attributes: Record<string, string>
  children: XmlNode[]
  text?: string
}

type XmlNode = XmlElement | string

/** Parse XML into a nested element tree. Handles self-closing tags, comments, and namespaced tags. */
function parseXml(xml: string): XmlElement | null {
  const str = xml.trim()
  if (!str.startsWith('<')) return null

  let pos = 0

  function skipWs(): void {
    while (pos < str.length && /\s/.test(str[pos])) pos++
  }

  function parseAttributes(tagContent: string): Record<string, string> {
    const attrs: Record<string, string> = {}
    const regex = /(\w+)=("([^"]*)"|'([^']*)')/g
    let match
    while ((match = regex.exec(tagContent)) !== null) {
      attrs[match[1]] = match[2] ? match[2].slice(1, -1) : match[3] ? match[3].slice(1, -1) : ''
    }
    return attrs
  }

  function parseNode(): XmlElement | string {
    skipWs()
    if (pos >= str.length) return ''

    // Text before next tag
    if (str[pos] !== '<') {
      let text = ''
      while (pos < str.length && str[pos] !== '<') {
        text += str[pos]
        pos++
      }
      const trimmed = text.trim()
      return trimmed || ''
    }

    // Comment
    if (str.startsWith('<!--', pos)) {
      const end = str.indexOf('-->', pos)
      if (end !== -1) {
        pos = end + 3
        return parseNode()
      }
      return ''
    }

    // Closing tag like </D:response>
    if (str.startsWith('</', pos)) {
      const endTag = str.indexOf('>', pos)
      if (endTag !== -1) {
        pos = endTag + 1
      }
      return ''
    }

    // Opening tag
    const tagEnd = str.indexOf('>', pos)
    if (tagEnd === -1) return ''

    const openContent = str.slice(pos + 1, tagEnd)
    const isSelfClosing = openContent.trimEnd().endsWith('/')
    const tagName = openContent.replace(/\s.*$/, '').replace(/\/?$/, '').trim()
    pos = tagEnd + 1

    const attributes = parseAttributes(openContent)

    const element: XmlElement = {
      name: tagName,
      attributes,
      children: [],
    }

    // Self-closing tag — no children
    if (isSelfClosing) {
      return element
    }

    let textContent = ''

    // Parse children until matching closing tag
    while (pos < str.length) {
      // Check if we've hit the closing tag
      if (str.startsWith(`</${tagName}>`, pos)) {
        pos += tagName.length + 3
        break
      }

      const child = parseNode()
      if (child === '') {
        // Could be whitespace or a closing tag marker — skip
      } else if (typeof child === 'string') {
        // Text content — accumulate it
        textContent += child + ' '
      } else {
        element.children.push(child)
      }
      skipWs()
    }

    // Capture any remaining inline text content after children
    let trailingText = ''
    while (pos < str.length && str[pos] !== '<') {
      trailingText += str[pos]
      pos++
    }
    textContent += trailingText

    const trimmed = textContent.trim()
    if (trimmed) {
      element.text = trimmed
    }

    return element
  }

  const result = parseNode()
  return result && typeof result !== 'string' ? result : null
}

/** Convert parsed XML element into a nested key-value object for easier access. */
function xmlToObj(element: XmlElement): Record<string, any> {
  const obj: Record<string, any> = {}

  for (const child of element.children) {
    if (typeof child !== 'string' && child.name) {
      const key = child.name

      let childValue: any
      if (child.children.length === 0 && child.text) {
        childValue = child.text
      } else {
        childValue = xmlToObj(child)
      }

      if (obj[key] !== undefined) {
        if (Array.isArray(obj[key])) {
          obj[key].push(childValue)
        } else {
          obj[key] = [obj[key], childValue]
        }
      } else {
        obj[key] = childValue
      }
    }
  }

  // Include text if present and no child elements
  if (element.text && element.children.length === 0 && Object.keys(obj).length === 0) {
    return { '': element.text }
  }

  return obj
}

export interface CalDAVCalendar {
  id: string
  name: string
  url: string
  color?: string
}

export interface CalDAVEvent {
  id: string
  uid: string
  summary: string
  description?: string
  location?: string
  start: string
  end: string
  allDay: boolean
  recurring?: boolean
  attendees?: { name?: string; email: string }[]
}

export interface CalDAVOptions {
  baseUrl: string
  username: string
  password: string
}

/** Default CalDAV endpoints for known providers */
const CALDAV_ENDPOINTS: Record<string, string> = {
  icloud: 'https://caldav.icloud.com/',
  google: 'https://apidata.googleusercontent.com/caldav/',
  fastmail: 'https://www.fastmail.com/dav/',
  gmail: 'https://apidata.googleusercontent.com/caldav/',
}

/** Get the CalDAV base URL for a known provider. */
export function getCaldavEndpoint(provider: keyof typeof CALDAV_ENDPOINTS): string {
  return CALDAV_ENDPOINTS[provider] || CALDAV_ENDPOINTS.icloud
}

function basicAuthHeader(username: string, password: string): string {
  const credentials = btoa(`${username}:${password}`)
  return `Basic ${credentials}`
}

/** Parse a CalDAV PROPFIND response to extract calendar list. */
function parseCalendars(xml: string): CalDAVCalendar[] {
  const root = parseXml(xml)
  if (!root) return []

  const parsed = xmlToObj(root)

  const response = parsed['D:multistatus']?.['D:response'] || []
  const responses = Array.isArray(response) ? response : [response]

  return responses
    .map((resp: any) => {
      const href = resp['D:href'] || ''
      const propStat = resp['D:propstat']
      const prop = propStat?.['D:prop'] || {}

      return {
        id: href || prop['D:calendar-color'] || '',
        name: prop['D:displayname'] || '',
        url: href || '',
        color: prop['C:calendar-color'] || undefined,
      }
    })
    .filter((cal) => cal.url)
}

/** Parse a CalDAV calendar-query response to extract events. */
function parseEvents(xml: string): CalDAVEvent[] {
  const root = parseXml(xml)
  if (!root) return []

  const parsed = xmlToObj(root)
  const multistatus = parsed['D:multistatus']
  if (!multistatus) return []

  const response = multistatus['D:response'] || []
  const responses = Array.isArray(response) ? response : [response]

  return responses.map((resp: any) => {
    const href = resp['D:href'] || ''
    const propStat = resp['D:propstat']
    const prop = propStat?.['D:prop'] || {}

    // The actual iCal content is in C:calendar-data
    const calendarData = prop['C:calendar-data'] || prop['ical'] || ''
    const parsedEvent = parseICalEvent(calendarData)

    return {
      id: href,
      uid: parsedEvent.uid || href,
      summary: parsedEvent.summary || prop['D:displayname'] || 'Untitled',
      description: parsedEvent.description,
      location: parsedEvent.location,
      start: parsedEvent.start || '',
      end: parsedEvent.end || '',
      allDay: parsedEvent.allDay,
      recurring: parsedEvent.recurring,
      attendees: parsedEvent.attendees,
    }
  }).filter((event) => event.summary && event.summary !== 'Untitled')
}

interface ParsedICalEvent {
  uid?: string
  summary?: string
  description?: string
  location?: string
  start: string
  end: string
  allDay: boolean
  recurring?: boolean
  attendees?: { name?: string; email: string }[]
}

/** Parse a simple iCalendar VEVENT component. */
function parseICalEvent(icalContent: string): ParsedICalEvent {
  const lines = icalContent.split(/\r?\n/)
  const result: ParsedICalEvent = {
    start: '',
    end: '',
    allDay: false,
  }

  let inEvent = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true
      continue
    }
    if (trimmed === 'END:VEVENT' || trimmed === 'END:CALENDAR') {
      if (trimmed === 'END:VEVENT') inEvent = false
      continue
    }
    if (!inEvent) continue

    const [prop, ...rest] = trimmed.split(':')
    const value = rest.join(':')

    switch (prop) {
      case 'UID':
        result.uid = value
        break
      case 'SUMMARY':
        result.summary = value
        break
      case 'DESCRIPTION':
        result.description = value
        break
      case 'LOCATION':
        result.location = value
        break
      case 'DTSTART':
      case 'DTSTART;VALUE=DATE':
        result.start = value
        result.allDay = prop.includes('VALUE=DATE')
        break
      case 'DTEND':
      case 'DTEND;VALUE=DATE':
        result.end = value
        result.allDay = prop.includes('VALUE=DATE')
        break
      case 'RRULE':
        result.recurring = true
        break
      case 'ATTENDEE':
        // Parse attendee line: ATTENDEE;CN=John Doe;RSVP=TRUE:mailto:john@example.com
        const cnMatch = trimmed.match(/CN=([^;:]+)/)
        const emailMatch = trimmed.match(/mailto:([^\s;]+)/i)
        if (emailMatch) {
          if (!result.attendees) result.attendees = []
          result.attendees.push({
            name: cnMatch ? cnMatch[1] : undefined,
            email: emailMatch[1],
          })
        }
        break
    }
  }

  // Convert iCalendar datetime format (YYYYMMDDTHHMMSSZ) to ISO
  if (result.start) {
    result.start = convertICalDate(result.start)
  }
  if (result.end) {
    result.end = convertICalDate(result.end)
  }

  return result
}

function convertICalDate(dateStr: string): string {
  // Handle date-only format: YYYYMMDD
  if (dateStr.length === 8) {
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    return `${year}-${month}-${day}`
  }

  // Handle datetime format: YYYYMMDDTHHMMSSZ
  if (dateStr.length >= 16) {
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    const hour = dateStr.slice(9, 11)
    const min = dateStr.slice(11, 13)
    const sec = dateStr.slice(13, 15)
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
  }

  return dateStr
}

/** Build a CalDAV PROPFIND XML body. */
function buildPropfindXml(prop: string): string {
  return `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:${prop} />
  </D:prop>
</D:propfind>`
}

/** Build a CalDAV calendar-query XML body with date range. */
function buildCalendarQueryXml(
  start: string,
  end: string,
  expand = true
): string {
  const startUtc = formatDateForCalDAV(start)
  const endUtc = formatDateForCalDAV(end)

  return `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:I="http://apple.com/ns/ical/">
  <D:prop>
    <D:getetag />
    <C:calendar-data>
      <C:comp name="VEVENT">
        <C:prop name="SUMMARY" />
        <C:prop name="DESCRIPTION" />
        <C:prop name="LOCATION" />
        <C:prop name="DTSTART" />
        <C:prop name="DTEND" />
        <C:prop name="RRULE" />
        <C:prop name="ATTENDEE" />
      </C:comp>
      <C:comp name="VTODO">
        <C:prop name="SUMMARY" />
        <C:prop name="DESCRIPTION" />
        <C:prop name="DUE" />
        <C:prop name="STATUS" />
        <C:prop name="ATTENDEE" />
      </C:comp>
    </C:calendar-data>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startUtc}" end="${endUtc}" />
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
  <C:limit>
    <C:limit-recent>yes</C:limit-recent>
  </C:limit>
</C:calendar-query>`
}

function formatDateForCalDAV(date: string): string {
  // Convert YYYY-MM-DD or ISO to YYYYMMDDTHHMMSSZ
  if (date.length === 10 && date.includes('-')) {
    const [year, month, day] = date.split('-')
    return `${year}${month}${day}T000000Z`
  }
  return date.replace(/[-:]/g, '').replace(/\.\d{3}/, 'Z')
}

/** Build a CalDAV VCALENDAR for creating a TODO/task. */
function buildTodoIcal(task: Omit<CalDAVEvent, 'id' | 'uid'> & { due?: string }): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, 'Z')
  const uid = `taskflow-${Date.now()}@taskflow.app`
  const due = task.due || task.start

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskFlow//CalDAV//EN
BEGIN:VTODO
UID:${uid}
SUMMARY:${escapeICalText(task.summary)}
DESCRIPTION:${escapeICalText(task.description || '')}
${due ? `DUE:${formatDateForCalDAV(due)}` : ''}
${task.location ? `LOCATION:${escapeICalText(task.location)}` : ''}
END:VTODO
END:VCALENDAR`
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export class CaldavClient {
  private baseUrl: string
  private username: string
  private password: string
  private headers: Record<string, string>

  constructor(options: CalDAVOptions) {
    this.baseUrl = options.baseUrl
    this.username = options.username
    this.password = options.password
    this.headers = {
      Authorization: basicAuthHeader(options.username, options.password),
      'Content-Type': 'text/xml; charset=utf-8',
      Depth: '1',
    }
  }

  /** Discover the list of calendars for the authenticated user. */
  async listCalendars(): Promise<CalDAVCalendar[]> {
    const xml = buildPropfindXml('calendar-home-set')
    const response = await this.request(this.baseUrl, 'PROPFIND', xml)

    if (!response.ok) {
      // Fallback: try the principal URL
      const principalUrl = await this.getPrincipalUrl()
      if (!principalUrl) throw new Error('Could not discover CalDAV principal URL')

      const calendarsXml = buildPropfindXml('calendar-home-set')
      const calResponse = await this.request(principalUrl, 'PROPFIND', calendarsXml)
      if (!calResponse.ok) throw new Error('Failed to list calendars')

      return parseCalendars(await calResponse.text())
    }

    return parseCalendars(await response.text())
  }

  /** Get the principal URL for the authenticated user. */
  async getPrincipalUrl(): Promise<string | null> {
    const xml = buildPropfindXml('principal-URL')
    const response = await this.request(this.baseUrl, 'PROPFIND', xml)

    if (!response.ok) return null

    const root = parseXml(await response.text())
    if (!root) return null
    const parsed = xmlToObj(root)
    const href = parsed?.['D:multistatus']?.['D:response']?.['D:propstat']?.['D:prop']?.['D:principal-URL']?.['D:href']

    return href || null
  }

  /** Fetch events from a specific calendar within a date range. */
  async getEvents(
    calendarUrl: string,
    startDate: string,
    endDate: string
  ): Promise<CalDAVEvent[]> {
    const xml = buildCalendarQueryXml(startDate, endDate)
    const response = await this.request(calendarUrl, 'REPORT', xml)

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`)
    }

    return parseEvents(await response.text())
  }

  /** Create a new task (VTODO) in the specified calendar. */
  async createTodo(calendarUrl: string, task: Omit<CalDAVEvent, 'id' | 'uid'> & { due?: string }): Promise<string> {
    const ical = buildTodoIcal(task)
    const response = await this.request(calendarUrl, 'PUT', ical)

    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.status}`)
    }

    return response.headers.get('Location') || ''
  }

  /** Delete a todo by its URL (etag). */
  async deleteTodo(todoUrl: string): Promise<boolean> {
    const response = await this.request(todoUrl, 'DELETE', '')
    return response.ok
  }

  /** Make a CalDAV HTTP request. */
  private async request(
    url: string,
    method: string,
    body: string
  ): Promise<Response> {
    const response = await fetch(url, {
      method,
      headers: this.headers,
      body,
    })

    if (response.status === 401) {
      throw new Error('CalDAV authentication failed — check username/password')
    }

    if (response.status === 403) {
      throw new Error('CalDAV access forbidden — check app-specific password permissions')
    }

    return response
  }
}

/**
 * Convert a CalDAV event to a TaskFlow Task object.
 */
export function caldavEventToTask(event: CalDAVEvent) {
  return {
    name: event.summary,
    description: event.description || null,
    date: event.allDay ? event.start : undefined,
    deadline: event.start,
    estimate: null,
    priority: 'none' as const,
    source_event_id: event.id,
    completed: false,
  }
}
