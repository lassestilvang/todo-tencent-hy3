/**
 * Keyboard shortcut bindings
 *
 * Customizable key combos stored in localStorage.
 * `saveShortcut` validates the combo before persisting;
 * `loadShortcuts` falls back to the defaults for anything
 * missing or malformed.
 */

export type ShortcutId =
  | 'commandPalette'
  | 'search'
  | 'newTask'
  | 'shortcutsHelp'

export interface KeyCombo {
  /** The final key, e.g. 'k' or '?'. Matched case-insensitively. */
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export const DEFAULT_SHORTCUTS: Record<ShortcutId, KeyCombo> = {
  commandPalette: { key: 'k', meta: true, ctrl: true },
  search: { key: 'k', meta: true, ctrl: true, shift: true },
  newTask: { key: 'n' },
  shortcutsHelp: { key: '?' },
}

export const SHORTCUT_STORAGE_KEY = 'taskflow_shortcuts'

/**
 * Whether an event satisfies a combo. Setting both `meta`
 * and `ctrl` means either modifier satisfies the combo —
 * the common Cmd/Ctrl convention. Unlisted modifiers are
 * not required to be absent, so a Cmd+Shift+K press still
 * matches a plain Cmd+K binding.
 */
export function matchesCombo(
  event: {
    key: string
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
  },
  combo: KeyCombo,
): boolean {
  if (event.key.toLowerCase() !== combo.key.toLowerCase()) {
    return false
  }

  const metaOrCtrl = combo.meta === true && combo.ctrl === true
  if (metaOrCtrl) {
    if (!event.metaKey && !event.ctrlKey) {
      return false
    }
  } else {
    if (combo.meta === true && !event.metaKey) {
      return false
    }
    if (combo.ctrl === true && !event.ctrlKey) {
      return false
    }
  }
  if (combo.shift === true && !event.shiftKey) {
    return false
  }
  if (combo.alt === true && !event.altKey) {
    return false
  }
  return true
}

/**
 * Keys beyond single characters that can be bound,
 * mapped to their canonical `event.key` values.
 */
const SPECIAL_KEYS = [
  'enter',
  'esc',
  'escape',
  'tab',
  'space',
  'backspace',
  'delete',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'home',
  'end',
  'pageup',
  'pagedown',
  'insert',
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]

/** Lowercase a key to its canonical form, or null when unsupported. */
function canonicalKey(key: string): string | null {
  const lower = key.toLowerCase()
  if (lower.length === 1) {
    return lower
  }
  if (!SPECIAL_KEYS.includes(lower)) {
    return null
  }
  if (lower === 'esc') {
    return 'escape'
  }
  if (lower === 'space') {
    return ' '
  }
  return lower
}

/** Label a key for display, e.g. ' ' -> "Space". */
function displayKey(key: string): string {
  if (key === ' ') {
    return 'Space'
  }
  if (key === 'escape') {
    return 'Esc'
  }
  if (key.length === 1) {
    return key.toUpperCase()
  }
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Parse "Cmd+Shift+K" style strings into combos. Accepts
 * meta/cmd/command, ctrl/control, alt/option/opt and
 * shift in any order; returns null for unknown tokens
 * or unsupported keys.
 */
export function parseCombo(combo: string): KeyCombo | null {
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)

  const key = parts.pop()
  if (!key) {
    return null
  }

  const canonical = canonicalKey(key)
  if (!canonical) {
    return null
  }

  const parsed: KeyCombo = { key: canonical }
  for (const part of parts) {
    // "Cmd/Ctrl" is the combined display form of the
    // common Cmd-or-Ctrl convention.
    if (part === 'cmd/ctrl' || part === 'ctrl/cmd') {
      parsed.meta = true
      parsed.ctrl = true
    } else if (part === 'meta' || part === 'cmd' || part === 'command') {
      parsed.meta = true
    } else if (part === 'ctrl' || part === 'control') {
      parsed.ctrl = true
    } else if (part === 'shift') {
      parsed.shift = true
    } else if (part === 'alt' || part === 'option' || part === 'opt') {
      parsed.alt = true
    } else {
      return null
    }
  }
  return parsed
}

/** Format a combo for display, e.g. "Cmd/Ctrl+Shift+K". */
export function formatCombo(combo: KeyCombo): string {
  const parts: string[] = []
  if (combo.meta && combo.ctrl) {
    parts.push('Cmd/Ctrl')
  } else {
    if (combo.ctrl) {
      parts.push('Ctrl')
    }
    if (combo.meta) {
      parts.push('Cmd')
    }
  }
  if (combo.alt) {
    parts.push('Alt')
  }
  if (combo.shift) {
    parts.push('Shift')
  }
  parts.push(displayKey(combo.key))
  return parts.join('+')
}

export function loadShortcuts(): Record<ShortcutId, KeyCombo> {
  const defaults: Record<ShortcutId, KeyCombo> = { ...DEFAULT_SHORTCUTS }
  if (typeof window === 'undefined') {
    return defaults
  }

  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY)
    if (!raw) {
      return defaults
    }
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) {
      return defaults
    }

    const record = parsed as Record<string, unknown>
    for (const id of Object.keys(DEFAULT_SHORTCUTS) as ShortcutId[]) {
      const value = record[id]
      const combo = typeof value === 'string' ? parseCombo(value) : null
      if (combo) {
        defaults[id] = combo
      }
    }
    return defaults
  } catch {
    return defaults
  }
}

/**
 * Persist a custom combo for a shortcut. Throws when the
 * combo cannot be parsed, so callers can surface the error.
 * Combos are stored as strings ("Cmd+K") so the payload
 * stays human-readable.
 */
export function saveShortcut(id: ShortcutId, combo: string): KeyCombo {
  const parsed = parseCombo(combo)
  if (!parsed) {
    throw new Error(`Invalid key combo: "${combo}"`)
  }

  const current = loadShortcuts()
  const next: Record<string, string> = {}
  for (const shortcutId of Object.keys(current) as ShortcutId[]) {
    next[shortcutId] = formatCombo(current[shortcutId])
  }
  next[id] = formatCombo(parsed)

  if (typeof window !== 'undefined') {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(next))
  }
  return parsed
}

export function resetShortcuts(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(SHORTCUT_STORAGE_KEY)
}
