/**
 * Meeting-to-Action Extractor
 *
 * Parses meeting transcripts, notes, or raw text to extract
 * actionable items using keyword detection and pattern matching.
 *
 * Action items are identified by:
 * - Explicit assignees: "@name please", "John, can you"
 * - Action verbs: "review", "prepare", "create", "schedule", etc.
 * - Deadlines: "by Friday", "by EOD", "by tomorrow"
 * - Time estimates: "30 min", "~1h"
 * - Priority cues: "urgent", "asap", "critical"
 *
 * The parser produces structured task objects that can be imported
 * directly into the task database.
 */

import { semanticSimilarity } from '@/lib/ai/embeddings'
import { parse } from 'date-fns'
import { parseNaturalLanguage } from '@/lib/nlp'

export interface ExtractedAction {
  text: string
  assignee: string | null
  assigneeMention: string | null // the original @mention or name reference
  deadline: string | null
  deadlineText: string | null // e.g. "by EOD Friday"
  estimate: number | null // minutes
  priority: 'high' | 'medium' | 'low' | 'none'
  confidence: number // 0-1
  context: string // surrounding conversation context
  sourceLine: string
}

export interface MeetingActionExtraction {
  actions: ExtractedAction[]
  meetingTitle: string | null
  participantCount: number
  actionVerbs: string[]
  confidence: number
}

// Action verbs that typically indicate task assignments
const ACTION_VERBS = [
  'review', 'prepare', 'create', 'schedule', 'book', 'draft', 'write',
  'send', 'update', 'fix', 'implement', 'design', 'build', 'test',
  'research', 'analyze', 'investigate', 'follow up', 'follow-up',
  'call', 'email', 'meet', 'discuss', 'present', 'share',
  'finalize', 'complete', 'submit', 'publish', 'launch',
  'setup', 'configure', 'deploy', 'migrate', 'backup',
  'document', 'record', 'transcribe', 'translate',
  'check', 'verify', 'confirm', 'validate', 'audit',
  'order', 'purchase', 'request', 'ask', 'consult',
  'plan', 'organize', 'coordinate', 'facilitate', 'moderate',
  'train', 'teach', 'mentor', 'support', 'assist',
]

// Verbs that indicate high-priority or urgent tasks
const HIGH_PRIORITY_WORDS = ['urgent', 'asap', 'immediately', 'critical', 'blocking', 'deadline']
const MEDIUM_PRIORITY_WORDS = ['important', 'soon', 'this week', 'priority']

// Deadline patterns
const DEADLINE_PATTERNS: { pattern: RegExp; text: string }[] = [
  { pattern: /b(?:y|efore)\s+(EOD|end of day)/i, text: 'EOD today' },
  { pattern: /b(?:y|efore)\s+(end of day)/i, text: 'EOD today' },
  { pattern: /(?:by|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, text: 'specific weekday' },
  { pattern: /(?:by|before)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i, text: 'specific date' },
  { pattern: /by\s+(tomorrow|tmr)/i, text: 'tomorrow' },
  { pattern: /by\s+(next week)/i, text: 'next week' },
  { pattern: /by\s+(end of week|weekend)/i, text: 'end of week' },
  { pattern: /by\s+(end of month)/i, text: 'end of month' },
  { pattern: /\bby\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, text: 'today at time' },
  { pattern: /by\s+(this week)/i, text: 'this week' },
]

// Time estimate patterns
const ESTIMATE_PATTERNS: { pattern: RegExp; minutes: number }[] = [
  { pattern: /(\d+)\s*min(?:ute)?s?/i, minutes: 0 }, // extracted dynamically
  { pattern: /(\d+)\s*hour/i, minutes: 0 },
  { pattern: /(\d+)h(?:\s*(\d+)m)?/i, minutes: 0 },
  { pattern: /~(\d+)\s*(min|hours?|h)/i, minutes: 0 },
]

// Assignee patterns: @name, "John", "Sarah will", "let's ask Alex"
const ASSIGNEE_PATTERNS: { pattern: RegExp; group: number }[] = [
  { pattern: /@(\w+)/g, group: 1 },
  { pattern: /\b([A-Z][a-z]+)\s*,?\s*(?:please|can you|could you|will you)\b/i, group: 1 },
  { pattern: /(?:let'?s ask|ask|assign(?:ed)? to|for)\s+([A-Z][a-z]+)/i, group: 1 },
  { pattern: /\b([A-Z][a-z]+)\s+(?:will|can|could|should)\s+/i, group: 1 },
]

/**
 * Extract action items from a meeting transcript or notes.
 *
 * The input can be:
 * - A raw transcript (multiple speakers)
 * - Bullet-point notes
 * - Freeform text with action items
 *
 * Returns structured action items ready for task creation.
 */
export function extractActionsFromMeeting(text: string): MeetingActionExtraction {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // Try to extract meeting title
  const titleMatch = text.match(/^#\s*(.+)$/m) || text.match(/^(.+)\n=+$/m) || text.match(/^(.+?)\s*$/m)
  const meetingTitle = titleMatch ? titleMatch[1].trim() : null

  // Count participants (lines starting with names or @mentions)
  const participantPattern = /^([A-Z][a-z]+|@\w+):\s*/g
  const participants = new Set<string>()
  let match
  while ((match = participantPattern.exec(text)) !== null) {
    participants.add(match[1])
  }

  const actions: ExtractedAction[] = []
  const foundVerbs = new Set<string>()

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip lines that are just headers, timestamps, or empty
    if (/^#+\s/.test(line) || /^\d{1,2}:\d{2}/.test(line) || line.length < 5) {
      continue
    }

    // Check if the line contains action verb patterns
    const verbMatch = findActionVerb(line)
    if (!verbMatch) continue

    foundVerbs.add(verbMatch.verb)

    // Extract action text
    const actionText = cleanActionText(line, verbMatch)

    // Extract assignee
    const assignee = extractAssignee(line)

    // Extract deadline
    const deadlineInfo = extractDeadline(line)

    // Extract time estimate
    const estimate = extractEstimate(line)

    // Determine priority
    const priority = extractPriority(line)

    // Calculate confidence
    const confidence = calculateConfidence(line, verbMatch, assignee !== null)

    // Get context (previous and next lines)
    const context = [
      lines[i - 1],
      line,
      lines[i + 1],
    ]
      .filter(Boolean)
      .join(' | ')

    actions.push({
      text: actionText,
      assignee: assignee?.name || null,
      assigneeMention: assignee?.mention || null,
      deadline: deadlineInfo?.date || null,
      deadlineText: deadlineInfo?.text || null,
      estimate,
      priority,
      confidence,
      context,
      sourceLine: line,
    })
  }

  // Deduplicate actions that reference the same text
  const uniqueActions = deduplicateActions(actions)

  const avgConfidence =
    uniqueActions.length > 0
      ? uniqueActions.reduce((sum, a) => sum + a.confidence, 0) / uniqueActions.length
      : 0

  return {
    actions: uniqueActions,
    meetingTitle,
    participantCount: participants.size,
    actionVerbs: Array.from(foundVerbs),
    confidence: avgConfidence,
  }
}

interface ActionVerbMatch {
  verb: string
  index: number
}

/** Find the first action verb in a line. */
function findActionVerb(line: string): ActionVerbMatch | null {
  const lower = line.toLowerCase()

  // Check multi-word verbs first
  const multiWordVerbs = ['follow up', 'follow-up', 'follow up on']
  for (const verb of multiWordVerbs) {
    const idx = lower.indexOf(verb)
    if (idx !== -1) {
      return { verb, index: idx }
    }
  }

  for (const verb of ACTION_VERBS) {
    // Match verb as a whole word
    const regex = new RegExp(`\\b${verb.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
    const match = regex.exec(line)
    if (match) {
      return { verb, index: match.index }
    }
  }

  // Also check for verb forms: "need to", "should", "must", "please"
  const obligationPatterns = [
    { pattern: /\b(need to|must|should)\s+(.+)/i },
    { pattern: /\b(please)\s+(.+)/i },
    { pattern: /\b(going to|will|shall)\s+(.+)/i },
  ]

  for (const { pattern } of obligationPatterns) {
    const match = line.match(pattern)
    if (match && match[2]) {
      // The action is what follows the obligation word
      return { verb: match[1], index: match.index ?? 0 }
    }
  }

  return null
}

/** Clean up the action text from a line. */
function cleanActionText(line: string, verbMatch: ActionVerbMatch): string {
  let text = line

  // Remove speaker prefix if present
  text = text.replace(/^([A-Z][a-z]+|@\w+):\s*/, '')

  // Remove the action verb from the beginning if it's the verb match
  const lowerText = text.toLowerCase()
  const lowerVerb = verbMatch.verb.toLowerCase()

  // Remove leading verbs/prefixes
  const prefixesToRemove = [
    `${verbMatch.verb}\\s+`,
    `need to\\s+`,
    `should\\s+`,
    `must\\s+`,
    `please\\s+`,
    `going to\\s+`,
    `will\\s+`,
    `shall\\s+`,
    `can you\\s+`,
    `could you\\s+`,
    `would you\\s+`,
    `let'?s\\s+`,
  ]

  for (const prefix of prefixesToRemove) {
    const regex = new RegExp(`^${prefix}`, 'i')
    const newText = text.replace(regex, '')
    if (newText !== text) {
      text = newText
      break
    }
  }

  // Remove trailing assignee, deadline, estimate
  text = text
    .replace(/\s*@[a-zA-Z]+\s*/g, ' ')
    .replace(
      /\s*by\s+(EOD|end of day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|this week|end of week|end of month)\s*/gi,
      ' '
    )
    .replace(/\s*~?\d+\s*(min|hour|hours?|h)?/gi, ' ')
    .replace(/\s*-\s*\d+\s*(min|hour|hours?|h)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Clean up punctuation
  text = text.replace(/^(?:-|•|\*)\s*/, '').replace(/[.;:]+$/, '')

  return text || line.replace(/^([A-Z][a-z]+|@\w+):\s*/, '')
}

interface AssigneeInfo {
  name: string
  mention: string
}

/** Extract assignee from a line. */
function extractAssignee(line: string): AssigneeInfo | null {
  for (const { pattern, group } of ASSIGNEE_PATTERNS) {
    const match = line.match(pattern)
    if (match && match[group]) {
      return {
        name: match[group],
        mention: match[0],
      }
    }
  }

  // Check for "assigned to X"
  const assignedMatch = line.match(/\b(?:assigned to|for)\s+([A-Z][a-z]+)\b/i)
  if (assignedMatch) {
    return { name: assignedMatch[1], mention: assignedMatch[0] }
  }

  return null
}

interface DeadlineInfo {
  date: string | null
  text: string
}

/** Extract deadline from a line. */
function extractDeadline(line: string): DeadlineInfo | null {
  for (const { pattern, text } of DEADLINE_PATTERNS) {
    const match = line.match(pattern)
    if (match) {
      const date = parseDeadlineToISO(match, pattern)
      return { date, text: match[0] }
    }
  }

  // Try parsing any date-like text
  const datePattern = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i
  const match = line.match(datePattern)
  if (match) {
    return { date: null, text: match[0] }
  }

  return null
}

function parseDeadlineToISO(match: RegExpMatchArray, pattern: RegExp): string | null {
  const matchedText = match[0].toLowerCase()

  try {
    const baseDate = new Date()

    if (matchedText.includes('eod') || matchedText.includes('end of day')) {
      return baseDate.toISOString().split('T')[0]
    }

    if (matchedText.includes('tomorrow')) {
      const tomorrow = new Date(baseDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    }

    // Day of week
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    for (let i = 0; i < dayNames.length; i++) {
      if (matchedText.includes(dayNames[i])) {
        const currentDay = baseDate.getDay()
        let diff = i - currentDay
        if (diff <= 0) diff += 7
        const target = new Date(baseDate)
        target.setDate(target.getDate() + diff)
        return target.toISOString().split('T')[0]
      }
    }

    if (matchedText.includes('end of week') || matchedText.includes('weekend')) {
      const day = baseDate.getDay()
      const diff = 6 - day // Saturday
      const target = new Date(baseDate)
      target.setDate(target.getDate() + diff)
      return target.toISOString().split('T')[0]
    }

    if (matchedText.includes('next week')) {
      const target = new Date(baseDate)
      target.setDate(target.getDate() + 7)
      return target.toISOString().split('T')[0]
    }

    if (matchedText.includes('end of month')) {
      const target = new Date(baseDate)
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0)
      return lastDay.toISOString().split('T')[0]
    }

    if (matchedText.includes('this week')) {
      const target = new Date(baseDate)
      target.setDate(target.getDate() + 3) // mid-week estimate
      return target.toISOString().split('T')[0]
    }

    // Time-based deadline
    const timeMatch = matchedText.match(/by\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10)
      const minutes = parseInt(timeMatch[2] || '0', 10)
      const ampm = timeMatch[3]?.toLowerCase()
      if (ampm === 'pm' && hours !== 12) hours += 12
      if (ampm === 'am' && hours === 12) hours = 0

      const target = new Date(baseDate)
      target.setHours(hours, minutes, 0, 0)
      return target.toISOString()
    }
  } catch (e) {
    return null
  }

  return null
}

/** Extract time estimate (in minutes) from a line. */
function extractEstimate(line: string): number | null {
  // Pattern: ~30 min, ~1h, 30min, 2 hours, 1h30m
  const patterns = [
    /~(\d+)\s*(?:min|minutes?)\b/i, // ~30 min
    /~(\d+)\s*(?:hour|hours?|h)\b/i, // ~1h
    /(\d+)\s*(?:min|minutes?)\b/i, // 30min
    /(\d+)\s*(?:hour|hours?)\b/i, // 2 hours
    /(\d+)h(?:\s*(\d+)m)?/i, // 1h30m
  ]

  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (match) {
      if (pattern === patterns[3] && match[1]) {
        // Hours pattern
        return parseInt(match[1], 10) * 60
      }
      if (pattern === patterns[4] && match[1]) {
        // h/m pattern
        const hours = parseInt(match[1], 10)
        const mins = match[2] ? parseInt(match[2], 10) : 0
        return hours * 60 + mins
      }
      return parseInt(match[1], 10)
    }
  }

  return null
}

/** Extract priority from a line. */
function extractPriority(line: string): 'high' | 'medium' | 'low' | 'none' {
  const lower = line.toLowerCase()

  for (const word of HIGH_PRIORITY_WORDS) {
    if (lower.includes(word)) return 'high'
  }

  for (const word of MEDIUM_PRIORITY_WORDS) {
    if (lower.includes(word)) return 'medium'
  }

  return 'none'
}

/** Calculate confidence score for an extracted action. */
function calculateConfidence(
  line: string,
  verbMatch: ActionVerbMatch,
  hasAssignee: boolean
): number {
  let score = 0.3

  // Base score for having an action verb
  score += 0.3

  // Has an assignee
  if (hasAssignee) score += 0.2

  // Has a deadline
  if (extractDeadline(line)) score += 0.15

  // Has an estimate
  if (extractEstimate(line)) score += 0.05

  return Math.min(score, 1.0)
}

/** Remove duplicate actions that have very similar text. */
function deduplicateActions(actions: ExtractedAction[]): ExtractedAction[] {
  if (actions.length <= 1) return actions

  const seen = new Set<string>()
  const result: ExtractedAction[] = []

  for (const action of actions) {
    const key = action.text.toLowerCase().slice(0, 40)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(action)
    }
  }

  return result
}

/**
 * Convert an extracted action into a partial task object
 * suitable for the task database.
 */
export function actionToTask(
  action: ExtractedAction
): { name: string; description: string | null; estimate: number | null; deadline: string | null; priority: 'high' | 'medium' | 'low' | 'none' } {
  // Use NLP parser to extract structured data from the action text
  const parsed = parseNaturalLanguage(action.text)

  return {
    name: action.text,
    description: action.context || null,
    estimate: action.estimate || parsed.estimate || null,
    deadline: action.deadline || parsed.deadline || null,
    priority: action.priority !== 'none' ? action.priority : parsed.priority || 'none',
  }
}
