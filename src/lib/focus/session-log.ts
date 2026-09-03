/**
 * Focus session history
 *
 * Appends completed/abandoned focus sessions to a localStorage
 * log that feeds the habit metrics and focus analytics view.
 * Browser-only: every entry point is a no-op without `window`
 * (e.g. when imported from a server route), never a crash.
 */

export interface FocusSession {
  /** Day the session happened on, `yyyy-MM-dd` */
  date: string
  /** Minutes spent — the full duration when completed, elapsed time when abandoned */
  durationMinutes: number
  /** Whether the session ran to completion */
  completed: boolean
}

export const STORAGE_KEY = 'focus-mode-history'

/** Keep a year of history at most. */
export const MAX_SESSIONS = 365

/** Parse a stored history payload, dropping malformed entries. */
export function parseFocusSessions(raw: string | null): FocusSession[] {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    // Drop malformed entries rather than failing the whole log.
    return parsed.filter(
      (entry): entry is FocusSession =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as FocusSession).date === 'string' &&
        typeof (entry as FocusSession).durationMinutes === 'number' &&
        typeof (entry as FocusSession).completed === 'boolean'
    )
  } catch {
    return []
  }
}

export function loadFocusSessions(): FocusSession[] {
  if (typeof window === 'undefined') {
    return []
  }

  return parseFocusSessions(localStorage.getItem(STORAGE_KEY))
}

export function recordFocusSession(session: FocusSession): void {
  if (typeof window === 'undefined') {
    return
  }

  const sessions = loadFocusSessions()
  sessions.push(session)

  // Trim oldest entries beyond the retention window.
  const trimmed = sessions.slice(-MAX_SESSIONS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function clearFocusSessions(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(STORAGE_KEY)
}
