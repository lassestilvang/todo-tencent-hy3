import { parse, isValid, addDays, startOfDay, endOfDay } from 'date-fns'
import { z } from 'zod'

// NLP Parser for natural language task input
// Supports formats like:
// "Buy groceries tomorrow 5pm #personal !high ~30m"
// "Finish report by Friday #work"
// "Call mom @ 3pm tomorrow"
// "Gym Mon Wed Fri 7am !high"

interface ParsedTask {
  name: string
  date?: string
  deadline?: string
  time?: string
  priority?: 'high' | 'medium' | 'low' | 'none'
  listId?: string
  estimate?: number
  recurring?: 'every_day' | 'every_week' | 'every_weekday' | 'every_month' | 'every_year' | 'custom'
  confidence: number
  originalInput: string
}

// Priority patterns
const PRIORITY_PATTERNS = [
  { pattern: /!(high|urgent|asap|critical)/i, priority: 'high' as const },
  { pattern: /!(medium|normal)/i, priority: 'medium' as const },
  { pattern: /!(low|minor)/i, priority: 'low' as const },
]

// List/tag patterns (#tag or @list)
const LIST_PATTERNS = [
  { pattern: /#(\w+)/g, type: 'tag' as const },
  { pattern: /@(\w+)/g, type: 'list' as const },
]

// Time estimate patterns (~30m, ~1h, ~2h30m)
const ESTIMATE_PATTERN = /~(\d+h)?(\d+m)?/i

// Recurring patterns
const RECURRING_PATTERNS = [
  { pattern: /\b(daily|every day)\b/i, recurring: 'every_day' as const },
  { pattern: /\b(weekly|every week)\b/i, recurring: 'every_week' as const },
  { pattern: /\b(weekdays|every weekday|mon-fri|monday to friday)\b/i, recurring: 'every_weekday' as const },
  { pattern: /\b(monthly|every month)\b/i, recurring: 'every_month' as const },
  { pattern: /\b(yearly|every year)\b/i, recurring: 'every_year' as const },
  { pattern: /\b(mon|monday)\b/i, recurring: 'every_week' as const, dayOfWeek: 1 },
  { pattern: /\b(tue|tuesday)\b/i, recurring: 'every_week' as const, dayOfWeek: 2 },
  { pattern: /\b(wed|wednesday)\b/i, recurring: 'every_week' as const, dayOfWeek: 3 },
  { pattern: /\b(thu|thursday)\b/i, recurring: 'every_week' as const, dayOfWeek: 4 },
  { pattern: /\b(fri|friday)\b/i, recurring: 'every_week' as const, dayOfWeek: 5 },
  { pattern: /\b(sat|saturday)\b/i, recurring: 'every_week' as const, dayOfWeek: 6 },
  { pattern: /\b(sun|sunday)\b/i, recurring: 'every_week' as const, dayOfWeek: 0 },
]

// Date/time patterns
const DATE_PATTERNS: Array<{
  pattern: RegExp
  days?: number
  months?: number
  endOfWeek?: boolean
}> = [
  { pattern: /\b(today)\b/i, days: 0 },
  { pattern: /\b(tomorrow|tmr)\b/i, days: 1 },
  { pattern: /\b(day after tomorrow)\b/i, days: 2 },
  { pattern: /\b(next week)\b/i, days: 7 },
  { pattern: /\b(this week)\b/i, days: 0, endOfWeek: true },
  { pattern: /\b(next month)\b/i, months: 1 },
]

// Time patterns (3pm, 15:00, 3:30pm)
const TIME_PATTERN = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i

// "by" deadline patterns
const DEADLINE_PATTERN = /\bby\s+(.+?)(?:\s+(?:#|@|~|!)|$)/i

export function parseNaturalLanguage(input: string, options?: {
  lists?: { id: string; name: string }[]
  defaultListId?: string
}): ParsedTask {
  const originalInput = input.trim()
  let workingInput = originalInput
  let confidence = 1.0

  const result: ParsedTask = {
    name: '',
    confidence: 0,
    originalInput,
  }

  // Extract priority
  for (const { pattern, priority } of PRIORITY_PATTERNS) {
    const match = workingInput.match(pattern)
    if (match) {
      result.priority = priority
      workingInput = workingInput.replace(pattern, '').trim()
      break
    }
  }

  // Extract list/tag references
  const tags: string[] = []
  const listRefs: string[] = []

  for (const { pattern, type } of LIST_PATTERNS) {
    let match
    while ((match = pattern.exec(workingInput)) !== null) {
      if (type === 'tag') {
        tags.push(match[1].toLowerCase())
      } else {
        listRefs.push(match[1].toLowerCase())
      }
    }
    workingInput = workingInput.replace(pattern, '').trim()
  }

  // Map list references to actual list IDs if lists provided
  if (options?.lists && listRefs.length > 0) {
    for (const ref of listRefs) {
      const list = options.lists.find(l =>
        l.name.toLowerCase().includes(ref) || l.id === ref
      )
      if (list) {
        result.listId = list.id
        break
      }
    }
  } else if (listRefs.length > 0) {
    // Store the first list ref as-is, will be resolved later
    result.listId = listRefs[0]
  }

  // Extract time estimate
  const estimateMatch = workingInput.match(ESTIMATE_PATTERN)
  if (estimateMatch) {
    const hours = parseInt(estimateMatch[1] || '0', 10)
    const minutes = parseInt(estimateMatch[2] || '0', 10)
    result.estimate = hours * 60 + minutes
    workingInput = workingInput.replace(ESTIMATE_PATTERN, '').trim()
  }

  // Extract recurring pattern
  for (const { pattern, recurring, dayOfWeek } of RECURRING_PATTERNS) {
    if (pattern.test(workingInput)) {
      result.recurring = recurring
      workingInput = workingInput.replace(pattern, '').trim()
      break
    }
  }

  // Extract deadline (by ...)
  const deadlineMatch = workingInput.match(DEADLINE_PATTERN)
  if (deadlineMatch) {
    const deadlineStr = deadlineMatch[1].trim()
    const parsedDate = parseRelativeDate(deadlineStr)
    if (parsedDate) {
      result.deadline = parsedDate
    }
    workingInput = workingInput.replace(DEADLINE_PATTERN, '').trim()
  }

  // Extract date references
  let foundDate = false
  for (const { pattern, days, months, endOfWeek } of DATE_PATTERNS) {
    if (pattern.test(workingInput)) {
      const baseDate = new Date()
      let targetDate: Date

      if (months) {
        targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + months, baseDate.getDate())
      } else if (endOfWeek) {
        targetDate = new Date(baseDate)
        const day = targetDate.getDay()
        const diff = 6 - day // Saturday
        targetDate.setDate(targetDate.getDate() + diff)
      } else if (days !== undefined) {
        targetDate = addDays(baseDate, days)
      } else {
        // Should not happen with current patterns, but handle gracefully
        targetDate = baseDate
      }

      result.date = formatDate(targetDate)
      foundDate = true
      workingInput = workingInput.replace(pattern, '').trim()
      break
    }
  }

  // Extract specific dates (Jan 15, 15th, etc.)
  if (!foundDate) {
    const specificDateMatch = workingInput.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?/i)
    if (specificDateMatch) {
      const month = specificDateMatch[1].toLowerCase()
      const day = parseInt(specificDateMatch[2], 10)
      const monthNum = getMonthNumber(month)
      if (monthNum !== -1) {
        const year = new Date().getFullYear()
        const date = new Date(year, monthNum, day)
        if (date < new Date()) {
          date.setFullYear(year + 1)
        }
        result.date = formatDate(date)
        workingInput = workingInput.replace(specificDateMatch[0], '').trim()
      }
    }
  }

  // Extract time
  const timeMatch = workingInput.match(TIME_PATTERN)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2] || '0', 10)
    const ampm = timeMatch[3]?.toLowerCase()

    if (ampm === 'pm' && hours !== 12) hours += 12
    if (ampm === 'am' && hours === 12) hours = 0

    result.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    // If we have a date but no deadline, combine date and time for deadline
    if (result.date && !result.deadline) {
      result.deadline = `${result.date}T${result.time}`
    }

    workingInput = workingInput.replace(TIME_PATTERN, '').trim()
  }

  // Clean up the remaining input as the task name
  result.name = workingInput
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim()

  // Calculate confidence based on how much we parsed
  let parsedElements = 0
  if (result.name) parsedElements++
  if (result.date) parsedElements++
  if (result.deadline) parsedElements++
  if (result.priority) parsedElements++
  if (result.listId) parsedElements++
  if (result.estimate) parsedElements++
  if (result.recurring) parsedElements++

  result.confidence = Math.min(parsedElements / 7, 1.0)

  return result
}

function parseRelativeDate(str: string): string | null {
  const lower = str.toLowerCase().trim()

  // Handle "today", "tomorrow", etc.
  for (const { pattern, days, months } of DATE_PATTERNS) {
    if (pattern.test(lower)) {
      const baseDate = new Date()
      let targetDate: Date
      if (months) {
        targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + months, baseDate.getDate())
      } else if (days !== undefined) {
        targetDate = addDays(baseDate, days)
      } else {
        targetDate = baseDate
      }
      return formatDate(targetDate)
    }
  }

  // Handle day names (Monday, Tuesday, etc.)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(dayNames[i])) {
      const baseDate = new Date()
      const currentDay = baseDate.getDay()
      let diff = i - currentDay
      if (diff <= 0) diff += 7
      const targetDate = addDays(baseDate, diff)
      return formatDate(targetDate)
    }
  }

  // Try parsing as a date
  try {
    const parsed = parse(str, 'MMM d, yyyy', new Date())
    if (isValid(parsed)) return formatDate(parsed)
  } catch {}

  try {
    const parsed = parse(str, 'MMMM d, yyyy', new Date())
    if (isValid(parsed)) return formatDate(parsed)
  } catch {}

  try {
    const parsed = parse(str, 'yyyy-MM-dd', new Date())
    if (isValid(parsed)) return formatDate(parsed)
  } catch {}

  return null
}

function getMonthNumber(month: string): number {
  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }
  return months[month.toLowerCase()] ?? -1
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Validation schema for parsed tasks
export const parsedTaskSchema = z.object({
  name: z.string().min(1).max(500),
  date: z.string().optional(),
  deadline: z.string().optional(),
  time: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  listId: z.string().optional(),
  estimate: z.number().int().positive().optional(),
  recurring: z.enum(['every_day', 'every_week', 'every_weekday', 'every_month', 'every_year', 'custom']).optional(),
})

export function validateParsedTask(task: ParsedTask): { valid: boolean; errors: string[] } {
  const result = parsedTaskSchema.safeParse(task)
  if (!result.success) {
    return { valid: false, errors: result.error.issues.map((e) => e.message) }
  }
  return { valid: true, errors: [] }
}

// Generate preview for command palette
export function generatePreview(parsed: ParsedTask): string {
  const parts: string[] = []

  if (parsed.name) parts.push(`📝 ${parsed.name}`)
  if (parsed.date) parts.push(`📅 ${parsed.date}`)
  if (parsed.time) parts.push(`🕐 ${parsed.time}`)
  if (parsed.deadline && parsed.deadline !== parsed.date) parts.push(`⏰ ${parsed.deadline}`)
  if (parsed.priority) parts.push(`🔴 ${parsed.priority}`)
  if (parsed.listId) parts.push(`📂 ${parsed.listId}`)
  if (parsed.estimate) parts.push(`⏱️ ~${Math.floor(parsed.estimate / 60)}h ${parsed.estimate % 60}m`)
  if (parsed.recurring) parts.push(`🔄 ${parsed.recurring.replace('every_', '').replace('_', ' ')}`)

  return parts.join('  ')
}