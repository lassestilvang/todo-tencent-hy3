import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_STORAGE_KEY,
  formatCombo,
  loadShortcuts,
  matchesCombo,
  parseCombo,
  resetShortcuts,
  saveShortcut,
  type KeyCombo,
  type ShortcutId,
} from '@/lib/shortcuts'

const STORAGE_KEY = SHORTCUT_STORAGE_KEY

const event = (overrides: Partial<{
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}> = {}) => ({
  key: 'k',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
})

describe('Combo parsing', () => {
  it('parses modifier prefixes', () => {
    expect(parseCombo('Cmd+K')).toEqual({ key: 'k', meta: true })
    expect(parseCombo('ctrl+shift+k')).toEqual({
      key: 'k',
      ctrl: true,
      shift: true,
    })
    expect(parseCombo('Alt+Option+P')).toEqual({
      key: 'p',
      alt: true,
    })
    expect(parseCombo('Meta+Ctrl+K')).toEqual({
      key: 'k',
      meta: true,
      ctrl: true,
    })
  })

  it('accepts alternative modifier names', () => {
    expect(parseCombo('cmd+k')).toEqual({ key: 'k', meta: true })
    expect(parseCombo('command+k')).toEqual({ key: 'k', meta: true })
    expect(parseCombo('control+k')).toEqual({ key: 'k', ctrl: true })
    expect(parseCombo('opt+j')).toEqual({ key: 'j', alt: true })
  })

  it('parses the combined Cmd/Ctrl display form', () => {
    expect(parseCombo('Cmd/Ctrl+K')).toEqual({
      key: 'k',
      meta: true,
      ctrl: true,
    })
    expect(parseCombo('Ctrl/Cmd+J')).toEqual({
      key: 'j',
      meta: true,
      ctrl: true,
    })
  })

  it('accepts a bare key', () => {
    expect(parseCombo('n')).toEqual({ key: 'n' })
    expect(parseCombo('?')).toEqual({ key: '?' })
    expect(parseCombo('F1')).toEqual({ key: 'f1' })
  })

  it('accepts special keys', () => {
    expect(parseCombo('Esc')).toEqual({ key: 'escape' })
    expect(parseCombo('Escape')).toEqual({ key: 'escape' })
    expect(parseCombo('Space')).toEqual({ key: ' ' })
    expect(parseCombo('ArrowUp')).toEqual({ key: 'arrowup' })
    expect(parseCombo('ctrl+Enter')).toEqual({
      key: 'enter',
      ctrl: true,
    })
  })

  it('normalizes modifier order', () => {
    expect(parseCombo('shift+ctrl+k')).toEqual(parseCombo('ctrl+shift+k'))
  })

  it('rejects malformed combos', () => {
    expect(parseCombo('')).toBeNull()
    expect(parseCombo('++')).toBeNull()
    expect(parseCombo('+')).toBeNull()
  })

  it('rejects unknown tokens and unsupported keys', () => {
    expect(parseCombo('cmd+xyz')).toBeNull()
    expect(parseCombo('not a combo!')).toBeNull()
    expect(parseCombo('ctrl+volumeup')).toBeNull()
    expect(parseCombo('ctrl+')).toBeNull()
  })
})

describe('Combo formatting', () => {
  it('formats a Cmd/Ctrl combo', () => {
    expect(formatCombo({ key: 'k', meta: true, ctrl: true })).toBe(
      'Cmd/Ctrl+K',
    )
  })

  it('formats every modifier', () => {
    expect(
      formatCombo({ key: 'k', meta: true, ctrl: true, shift: true }),
    ).toBe('Cmd/Ctrl+Shift+K')
    expect(formatCombo({ key: 'j', alt: true })).toBe('Alt+J')
    expect(formatCombo({ key: 'n' })).toBe('N')
    expect(formatCombo({ key: '?' })).toBe('?')
  })

  it('formats special keys', () => {
    expect(formatCombo({ key: ' ' })).toBe('Space')
    expect(formatCombo({ key: 'escape' })).toBe('Esc')
    expect(formatCombo({ key: 'f1' })).toBe('F1')
    expect(formatCombo({ key: 'arrowup', shift: true })).toBe(
      'Shift+Arrowup',
    )
  })

  it('round-trips through parsing', () => {
    const combos: KeyCombo[] = [
      { key: 'k', meta: true, ctrl: true },
      { key: 'k', meta: true, ctrl: true, shift: true },
      { key: 'n' },
      { key: '?' },
      { key: 'p', alt: true, shift: true },
      { key: ' ' },
      { key: 'escape' },
      { key: 'f1', ctrl: true },
      { key: 'arrowup', shift: true },
    ]

    for (const combo of combos) {
      expect(parseCombo(formatCombo(combo))).toEqual(combo)
    }
  })
})

describe('Combo matching', () => {
  it('matches either Meta or Ctrl when both are set', () => {
    const combo = DEFAULT_SHORTCUTS.commandPalette
    expect(matchesCombo(event({ metaKey: true }), combo)).toBe(true)
    expect(matchesCombo(event({ ctrlKey: true }), combo)).toBe(true)
    expect(matchesCombo(event(), combo)).toBe(false)
    expect(
      matchesCombo(event({ metaKey: true, altKey: true }), combo),
    ).toBe(true)
  })

  it('matches case-insensitively', () => {
    const combo = DEFAULT_SHORTCUTS.search
    expect(
      matchesCombo(event({ metaKey: true, shiftKey: true, key: 'K' }), combo),
    ).toBe(true)
    expect(
      matchesCombo(event({ ctrlKey: true, shiftKey: true, key: 'k' }), combo),
    ).toBe(true)
  })

  it('requires the shift modifier when listed', () => {
    const combo = DEFAULT_SHORTCUTS.search
    // Shift is required for search…
    expect(
      matchesCombo(event({ metaKey: true, shiftKey: true }), combo),
    ).toBe(true)
    // …so the plain palette combo does not open search.
    expect(matchesCombo(event({ metaKey: true }), combo)).toBe(false)
  })

  it('requires an exact key', () => {
    expect(
      matchesCombo(event({ metaKey: true, key: 'j' }), DEFAULT_SHORTCUTS.commandPalette),
    ).toBe(false)
  })

  it('matches bare keys with or without modifiers', () => {
    expect(matchesCombo(event({ key: 'n' }), DEFAULT_SHORTCUTS.newTask)).toBe(
      true,
    )
    expect(
      matchesCombo(event({ key: 'N', metaKey: true }), DEFAULT_SHORTCUTS.newTask),
    ).toBe(true)
  })

  it('matches alt combos', () => {
    const combo: KeyCombo = { key: 'p', alt: true }
    expect(matchesCombo(event({ altKey: true, key: 'p' }), combo)).toBe(true)
    expect(matchesCombo(event({ key: 'p' }), combo)).toBe(false)
    expect(matchesCombo(event({ metaKey: true, key: 'p' }), combo)).toBe(
      false,
    )
  })
})

describe('Shortcut storage', () => {
  beforeEach(() => {
    resetShortcuts()
  })

  it('returns the defaults without storage', () => {
    expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS)
  })

  it('saves and loads a custom combo', () => {
    const saved = saveShortcut('commandPalette', 'Alt+Shift+K')

    expect(saved).toEqual({ key: 'k', alt: true, shift: true })
    expect(loadShortcuts().commandPalette).toEqual(saved)
    expect(loadShortcuts().search).toEqual(DEFAULT_SHORTCUTS.search)
  })

  it('throws for invalid combos without writing', () => {
    expect(() => saveShortcut('commandPalette', 'not a combo!')).toThrow()
    expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS)
  })

  it('persists every shortcut id', () => {
    saveShortcut('search', 'F2')
    saveShortcut('newTask', 'Alt+N')
    saveShortcut('shortcutsHelp', 'Ctrl+/')

    const loaded = loadShortcuts()
    expect(loaded.search).toEqual({ key: 'f2' })
    expect(loaded.newTask).toEqual({ key: 'n', alt: true })
    expect(loaded.shortcutsHelp).toEqual({ key: '/', ctrl: true })
  })

  it('round-trips a Cmd/Ctrl combo through storage', () => {
    saveShortcut('newTask', 'Cmd/Ctrl+J')

    expect(loadShortcuts().newTask).toEqual({
      key: 'j',
      meta: true,
      ctrl: true,
    })
  })

  it('ignores malformed stored values', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        commandPalette: 'Alt+K',
        search: 42,
        newTask: 'cmd+xyz',
        shortcutsHelp: null,
        unknownAction: 'Alt+U',
      }),
    )

    const loaded = loadShortcuts()
    expect(loaded.commandPalette).toEqual({ key: 'k', alt: true })
    expect(loaded.search).toEqual(DEFAULT_SHORTCUTS.search)
    expect(loaded.newTask).toEqual(DEFAULT_SHORTCUTS.newTask)
    expect(loaded.shortcutsHelp).toEqual(DEFAULT_SHORTCUTS.shortcutsHelp)
  })

  it('returns the defaults for corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS)

    localStorage.setItem(STORAGE_KEY, '["Alt+K"]')
    expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS)
  })

  it('resets to the defaults', () => {
    saveShortcut('commandPalette', 'Alt+K')
    resetShortcuts()

    expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('keeps a saved combo working after a reload', () => {
    saveShortcut('newTask', 'Ctrl+Shift+N')

    // A fresh load (as after a page reload) keeps the
    // customization, and it still matches real events.
    const combo = loadShortcuts().newTask
    expect(
      matchesCombo(
        event({ ctrlKey: true, shiftKey: true, key: 'N' }),
        combo,
      ),
    ).toBe(true)
  })
})

describe('Shortcut ids', () => {
  it('covers every customizable action', () => {
    const ids: ShortcutId[] = [
      'commandPalette',
      'search',
      'newTask',
      'shortcutsHelp',
    ]
    expect(Object.keys(DEFAULT_SHORTCUTS).sort()).toEqual(
      [...ids].sort(),
    )
  })
})
