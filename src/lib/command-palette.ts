/**
 * Command palette engine
 *
 * Pure logic behind the command palette: the built-in command
 * registry, natural-language command detection ("go to analytics",
 * "> show completed"), fuzzy search, and the usage history that
 * powers both "recent commands" and context-aware suggestions.
 *
 * History entry points are no-ops without `window` (e.g. when
 * imported from a server route), never a crash.
 */

export type CommandCategory = 'Navigation' | 'Task' | 'View' | 'Help'

export interface PaletteCommand {
  /** Stable identifier used for history and suggestions. */
  id: string
  title: string
  category: CommandCategory
  /** Words that also match when searching. */
  keywords: string[]
}

export const COMMANDS: PaletteCommand[] = [
  {
    id: 'goto.today',
    title: 'Go to Today',
    category: 'Navigation',
    keywords: ['home', '1', 'today'],
  },
  {
    id: 'goto.next7',
    title: 'Go to Next 7 Days',
    category: 'Navigation',
    keywords: ['week', '2', 'next'],
  },
  {
    id: 'goto.upcoming',
    title: 'Go to Upcoming',
    category: 'Navigation',
    keywords: ['future', '3', 'upcoming'],
  },
  {
    id: 'goto.all',
    title: 'Go to All Tasks',
    category: 'Navigation',
    keywords: ['everything', '4', 'all'],
  },
  {
    id: 'goto.analytics',
    title: 'Open Analytics',
    category: 'Navigation',
    keywords: ['stats', 'dashboard', 'trends'],
  },
  {
    id: 'goto.workflows',
    title: 'Open Workflows',
    category: 'Navigation',
    keywords: ['automations', 'rules'],
  },
  {
    id: 'goto.settings',
    title: 'Open Settings',
    category: 'Navigation',
    keywords: ['preferences', 'config'],
  },
  {
    id: 'task.create',
    title: 'Create new task',
    category: 'Task',
    keywords: ['add', 'new', 'quick add'],
  },
  {
    id: 'task.search',
    title: 'Search tasks',
    category: 'Task',
    keywords: ['find', 'filter', 'lookup'],
  },
  {
    id: 'task.clearCompleted',
    title: 'Clear completed tasks',
    category: 'Task',
    keywords: ['delete', 'done', 'remove', 'clean'],
  },
  {
    id: 'view.showCompleted',
    title: 'Show completed tasks',
    category: 'View',
    keywords: ['done', 'finished', 'completed'],
  },
  {
    id: 'view.hideCompleted',
    title: 'Hide completed tasks',
    category: 'View',
    keywords: ['hide', 'active', 'remaining'],
  },
  {
    id: 'help.shortcuts',
    title: 'Show keyboard shortcuts',
    category: 'Help',
    keywords: ['keys', 'hotkeys', 'help'],
  },
]

export interface ParsedCommandInput {
  /** Commands run actions; tasks are created from the text. */
  mode: 'task' | 'command'
  /** The remaining text once command mode is detected. */
  query: string
}

/** Prefix that always enters command mode. */
export const COMMAND_PREFIX = '>'

/** Verbs that turn plain text into a command ("open analytics"). */
const COMMAND_VERBS = new Set([
  'go',
  'goto',
  'navigate',
  'open',
  'show',
  'hide',
  'display',
  'clear',
  'start',
  'run',
  'search',
  'filter',
])

export function parseCommandInput(input: string): ParsedCommandInput {
  const trimmed = input.trim()
  if (!trimmed) {
    return { mode: 'task', query: '' }
  }
  if (trimmed.startsWith(COMMAND_PREFIX)) {
    return { mode: 'command', query: trimmed.slice(1).trim() }
  }
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase()
  if (COMMAND_VERBS.has(firstWord)) {
    return { mode: 'command', query: trimmed }
  }
  return { mode: 'task', query: trimmed }
}

/**
 * Subsequence match between a query and some text. Returns a
 * 0..1 score where exact and prefix matches rank highest, or -1
 * when the query is not a subsequence of the text.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  const t = text.toLowerCase()
  if (!q) {
    return 0
  }

  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) {
      qi += 1
    }
  }
  if (qi < q.length) {
    return -1
  }

  if (t === q) {
    return 1
  }
  if (t.startsWith(q)) {
    return 0.9
  }
  if (t.split(/[\s-]+/).some((word) => word.startsWith(q))) {
    return 0.7
  }
  return 0.4
}

/** Fuzzy-match a query against command titles and keywords. */
export function searchCommands(
  query: string,
  commands: PaletteCommand[] = COMMANDS,
): PaletteCommand[] {
  const q = query.trim()
  if (!q) {
    return commands
  }

  return commands
    .map((command) => {
      const titleScore = fuzzyScore(q, command.title)
      const keywordScore = command.keywords.reduce(
        (best, keyword) => Math.max(best, fuzzyScore(q, keyword)),
        -1,
      )
      return { command, score: Math.max(titleScore, keywordScore) }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.command)
}

export const HISTORY_STORAGE_KEY = 'taskflow_command_history'

/** Keep 50 commands of history at most. */
export const MAX_HISTORY = 50

export interface CommandUsage {
  commandId: string
  /** How many times the command has run. */
  count: number
  /** ISO timestamp of the most recent run. */
  lastUsedAt: string
}

/** Parse a stored history payload, dropping malformed entries. */
export function parseCommandHistory(raw: string | null): CommandUsage[] {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (entry): entry is CommandUsage =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as CommandUsage).commandId === 'string' &&
        typeof (entry as CommandUsage).count === 'number' &&
        typeof (entry as CommandUsage).lastUsedAt === 'string',
    )
  } catch {
    return []
  }
}

export function loadCommandHistory(): CommandUsage[] {
  if (typeof window === 'undefined') {
    return []
  }
  return parseCommandHistory(localStorage.getItem(HISTORY_STORAGE_KEY))
}

/**
 * Log a command run, incrementing its counter and bumping its
 * timestamp. Returns the updated (and trimmed) history.
 */
export function recordCommandUsage(
  commandId: string,
  now: Date = new Date(),
): CommandUsage[] {
  if (typeof window === 'undefined') {
    return []
  }

  const history = loadCommandHistory()
  const existing = history.find((usage) => usage.commandId === commandId)
  const updated: CommandUsage[] = existing
    ? history.map((usage) =>
        usage.commandId === commandId
          ? { ...usage, count: usage.count + 1, lastUsedAt: now.toISOString() }
          : usage,
      )
    : [...history, { commandId, count: 1, lastUsedAt: now.toISOString() }]

  // Store oldest-first so trimming drops the stalest entries.
  const trimmed = updated
    .sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt))
    .slice(-MAX_HISTORY)

  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed))
  return trimmed
}

export function clearCommandHistory(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(HISTORY_STORAGE_KEY)
}

/** The most recently used entries, newest first. */
export function getRecentCommands(
  history: CommandUsage[] = [],
  limit = 8,
): CommandUsage[] {
  return [...history]
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit)
}

export function findCommand(
  commandId: string,
  commands: PaletteCommand[] = COMMANDS,
): PaletteCommand | undefined {
  return commands.find((command) => command.id === commandId)
}

export interface CommandContext {
  /** Local hour of day, 0-23. */
  hourOfDay: number
  /** Day of week, 0 (Sunday) to 6 (Saturday). */
  dayOfWeek: number
}

export function toCommandContext(now: Date): CommandContext {
  return { hourOfDay: now.getHours(), dayOfWeek: now.getDay() }
}

/**
 * Time-of-day / day-of-week affinity (0-1). Morning surfaces the
 * day view and task creation, Monday and evenings surface analytics
 * for planning and review, Sunday evening and Monday morning surface
 * the upcoming view. Commands without an explicit affinity keep a
 * small default so suggestions are always populated.
 */
const COMMAND_AFFINITY: Record<string, (context: CommandContext) => number> = {
  'goto.today': ({ hourOfDay }) =>
    hourOfDay < 12 ? 0.7 : hourOfDay < 18 ? 0.3 : 0.1,
  'task.create': ({ hourOfDay }) =>
    (hourOfDay >= 9 && hourOfDay < 12) ||
    (hourOfDay >= 13 && hourOfDay < 16)
      ? 0.6
      : 0.1,
  'goto.analytics': ({ hourOfDay, dayOfWeek }) =>
    dayOfWeek === 1
      ? 0.9
      : hourOfDay >= 17 && hourOfDay < 22
        ? 0.6
        : 0.1,
  'goto.upcoming': ({ hourOfDay, dayOfWeek }) =>
    (dayOfWeek === 0 && hourOfDay >= 16) || (dayOfWeek === 1 && hourOfDay < 10)
      ? 0.7
      : 0.1,
  'goto.next7': () => 0.15,
  'goto.all': () => 0.15,
  'task.search': () => 0.2,
  'task.clearCompleted': () => 0.1,
  'view.showCompleted': () => 0.1,
  'view.hideCompleted': () => 0.1,
  'goto.workflows': () => 0.1,
  'goto.settings': () => 0.1,
  'help.shortcuts': () => 0.1,
}

export interface SuggestionOptions {
  commands?: PaletteCommand[]
  history?: CommandUsage[]
  /** Epoch ms used for recency decay; defaults to now. */
  now?: number
  limit?: number
}

/**
 * Rank commands for the current moment. Learned usage (frequency
 * 45%, recency 35%) is blended with time-of-day affinity (20%),
 * so frequently used commands float up while the moment still
 * shapes what appears first.
 */
export function suggestCommands(
  context: CommandContext,
  options: SuggestionOptions = {},
): PaletteCommand[] {
  const commands = options.commands ?? COMMANDS
  const history = options.history ?? []
  const now = options.now ?? Date.now()
  const limit = options.limit ?? 5

  const usageById = new Map(history.map((usage) => [usage.commandId, usage]))
  const weekMs = 7 * 24 * 60 * 60 * 1000

  return commands
    .map((command) => {
      const usage = usageById.get(command.id)
      // Log scale so heavy use doesn't pin a command to the top forever.
      const frequency = usage ? Math.log2(usage.count + 1) / 4 : 0
      const parsedAt = usage ? Date.parse(usage.lastUsedAt) : Number.NaN
      const ageMs = Number.isFinite(parsedAt)
        ? Math.max(0, now - (parsedAt as number))
        : weekMs
      const recency = usage ? Math.max(0, 1 - ageMs / weekMs) : 0
      const affinity = (COMMAND_AFFINITY[command.id] ?? (() => 0.05))(context)
      return {
        command,
        score: frequency * 0.45 + recency * 0.35 + affinity * 0.2,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.command)
}
