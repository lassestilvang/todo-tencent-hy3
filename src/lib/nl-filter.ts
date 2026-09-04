/**
 * Natural-language filter queries
 *
 * Parses plain-English filter requests ("show high
 * priority tasks due today") into the structured
 * `TaskFilter` the task list understands, so the
 * search box accepts both keywords and sentences.
 * Anything the parser does not recognize falls
 * through to the free-text search field.
 */

import type { Priority } from '@/types'
import type { TaskFilter, TaskView } from './filter-presets'

/**
 * Multi-word phrases, consumed before single words.
 * Checked longest-first so "next 7 days" wins over
 * "next".
 */
const PHRASE_ACTIONS: Record<string, (filter: TaskFilter) => void> = {
  'high priority': (f) => {
    f.priority = 'high'
  },
  'top priority': (f) => {
    f.priority = 'high'
  },
  'medium priority': (f) => {
    f.priority = 'medium'
  },
  'low priority': (f) => {
    f.priority = 'low'
  },
  'no priority': (f) => {
    f.priority = 'none'
  },
  'due today': (f) => {
    f.view = 'today'
  },
  'next 7 days': (f) => {
    f.view = 'next7'
  },
  'next seven days': (f) => {
    f.view = 'next7'
  },
  'this week': (f) => {
    f.view = 'next7'
  },
  'next week': (f) => {
    f.view = 'next7'
  },
}

const PRIORITY_WORDS: Record<string, Priority> = {
  urgent: 'high',
  important: 'high',
  critical: 'high',
  high: 'high',
  p1: 'high',
  medium: 'medium',
  normal: 'medium',
  p2: 'medium',
  low: 'low',
  p3: 'low',
  unprioritized: 'none',
}

const STATUS_WORDS: Record<string, boolean> = {
  done: true,
  completed: true,
  complete: true,
  finished: true,
  checked: true,
  closed: true,
  active: false,
  open: false,
  pending: false,
  remaining: false,
  unfinished: false,
}

const WINDOW_WORDS: Record<string, TaskView> = {
  today: 'today',
  week: 'next7',
  upcoming: 'upcoming',
  future: 'upcoming',
  later: 'upcoming',
  someday: 'upcoming',
  all: 'all',
  everything: 'all',
}

/** Words that negate the word that follows them. */
const NEGATION_WORDS = new Set([
  'not',
  'no',
  'without',
  'hide',
  'exclude',
  'dont',
])

const OVERDUE_WORDS = new Set(['overdue', 'late'])

/** Common words that carry no filter meaning. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'that',
  'this',
  'these',
  'those',
  'my',
  'me',
  'i',
  'you',
  'your',
  'our',
  'we',
  'it',
  'its',
  'show',
  'find',
  'list',
  'display',
  'give',
  'please',
  'want',
  'need',
  'tasks',
  'task',
  'item',
  'items',
  'stuff',
  'things',
  'due',
])

/** Normalize a query into lowercase space-separated words. */
function tokenize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse a natural-language filter query. Unknown words
 * are collected into the free-text `search` field, so
 * "urgent report" filters to high priority and searches
 * for "report" at the same time.
 */
export function parseFilterQuery(input: string): TaskFilter {
  const filter: TaskFilter = {}
  const normalized = tokenize(input)
  if (!normalized) {
    return filter
  }

  // Consume multi-word phrases first, longest first,
  // so "high priority" is never read as two words.
  let rest = ` ${normalized} `
  const phrases = Object.keys(PHRASE_ACTIONS).sort(
    (a, b) => b.length - a.length,
  )
  for (const phrase of phrases) {
    const padded = ` ${phrase} `
    if (rest.includes(padded)) {
      PHRASE_ACTIONS[phrase](filter)
      rest = rest.replace(padded, ' ')
    }
  }

  const words = rest.split(' ').filter(Boolean)
  const searchWords: string[] = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const next = words[i + 1]

    // A negation word flips the meaning of the word
    // that follows it: "not done", "hide completed".
    if (NEGATION_WORDS.has(word)) {
      if (next !== undefined && STATUS_WORDS[next] !== undefined) {
        filter.completed = !STATUS_WORDS[next]
        i++
      }
      continue
    }

    if (OVERDUE_WORDS.has(word)) {
      filter.overdue = true
      continue
    }

    const status = STATUS_WORDS[word]
    if (status !== undefined) {
      filter.completed = status
      continue
    }

    const priority = PRIORITY_WORDS[word]
    if (priority !== undefined) {
      filter.priority = priority
      continue
    }

    const view = WINDOW_WORDS[word]
    if (view !== undefined) {
      filter.view = view
      continue
    }

    if (!STOP_WORDS.has(word)) {
      searchWords.push(word)
    }
  }

  const search = searchWords.join(' ').trim()
  if (search) {
    filter.search = search
  }

  return filter
}

/** Human-readable summary of a filter, for UI labels. */
export function describeFilter(filter: TaskFilter): string {
  const parts: string[] = []

  if (filter.overdue) {
    parts.push('overdue')
  }
  if (filter.priority && filter.priority !== 'none') {
    parts.push(`${filter.priority}-priority`)
  } else if (filter.priority === 'none') {
    parts.push('unprioritized')
  }
  if (filter.view === 'today') {
    parts.push('due today')
  } else if (filter.view === 'next7') {
    parts.push('due this week')
  } else if (filter.view === 'upcoming') {
    parts.push('upcoming')
  } else if (filter.view === 'all') {
    parts.push('all')
  }
  if (filter.completed === true) {
    parts.push('completed')
  } else if (filter.completed === false) {
    parts.push('active')
  }
  if (filter.search) {
    parts.push(`"${filter.search}"`)
  }

  if (parts.length === 0) {
    return 'all tasks'
  }

  return `${parts.join(' ')} tasks`
}

/**
 * Whether a parsed query carries structured criteria —
 * the search dialog offers to apply it as a filter
 * only then, so plain keyword searches are untouched.
 */
export function hasFilterCriteria(filter: TaskFilter): boolean {
  return (
    filter.view !== undefined ||
    filter.priority !== undefined ||
    filter.completed !== undefined ||
    filter.overdue !== undefined
  )
}
