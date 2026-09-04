import {
  COMMANDS,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY,
  clearCommandHistory,
  findCommand,
  fuzzyScore,
  getRecentCommands,
  loadCommandHistory,
  parseCommandHistory,
  parseCommandInput,
  recordCommandUsage,
  searchCommands,
  suggestCommands,
  toCommandContext,
  type CommandUsage,
} from '@/lib/command-palette'

const STORAGE_KEY = HISTORY_STORAGE_KEY

describe('Command input parsing', () => {
  it('treats empty input as a task', () => {
    expect(parseCommandInput('')).toEqual({ mode: 'task', query: '' })
    expect(parseCommandInput('   ')).toEqual({ mode: 'task', query: '' })
  })

  it('enters command mode for the > prefix', () => {
    expect(parseCommandInput('> analytics')).toEqual({
      mode: 'command',
      query: 'analytics',
    })
    expect(parseCommandInput('>clear completed')).toEqual({
      mode: 'command',
      query: 'clear completed',
    })
  })

  it('enters command mode for command verbs', () => {
    expect(parseCommandInput('go to analytics').mode).toBe('command')
    expect(parseCommandInput('open analytics').mode).toBe('command')
    expect(parseCommandInput('show completed tasks').mode).toBe('command')
    expect(parseCommandInput('hide completed').mode).toBe('command')
    expect(parseCommandInput('clear completed').mode).toBe('command')
    expect(parseCommandInput('search report').mode).toBe('command')
    expect(parseCommandInput('navigate to workflows').mode).toBe('command')
  })

  it('keeps plain sentences in task mode', () => {
    // "create" is deliberately not a command verb so
    // "create quarterly report" stays a task name.
    expect(parseCommandInput('create quarterly report').mode).toBe('task')
    expect(parseCommandInput('Buy groceries tomorrow 5pm').mode).toBe('task')
    expect(parseCommandInput('finish the report').mode).toBe('task')
  })

  it('preserves the query after command detection', () => {
    expect(parseCommandInput('  go to  analytics  ')).toEqual({
      mode: 'command',
      query: 'go to  analytics',
    })
  })
})

describe('Fuzzy scoring', () => {
  it('scores exact matches highest', () => {
    expect(fuzzyScore('analytics', 'analytics')).toBe(1)
    expect(fuzzyScore('ANALYTICS', 'analytics')).toBe(1)
  })

  it('scores prefix matches next', () => {
    expect(fuzzyScore('go to', 'go to today')).toBe(0.9)
  })

  it('scores word-start matches above loose subsequences', () => {
    expect(fuzzyScore('tod', 'go to today')).toBe(0.7)
    expect(fuzzyScore('gt', 'go to today')).toBe(0.4)
  })

  it('returns -1 when the query is not a subsequence', () => {
    expect(fuzzyScore('xyz', 'go to today')).toBe(-1)
    expect(fuzzyScore('qz', 'analytics')).toBe(-1)
  })

  it('returns 0 for an empty query', () => {
    expect(fuzzyScore('', 'go to today')).toBe(0)
  })
})

describe('Command search', () => {
  it('returns every command for an empty query', () => {
    expect(searchCommands('')).toEqual(COMMANDS)
  })

  it('matches titles and ranks the best hit first', () => {
    const results = searchCommands('analytics')
    expect(results[0].id).toBe('goto.analytics')
  })

  it('matches case-insensitively', () => {
    const results = searchCommands('ANALYTICS')
    expect(results[0].id).toBe('goto.analytics')
  })

  it('matches keywords', () => {
    expect(searchCommands('automations')[0].id).toBe('goto.workflows')
    expect(searchCommands('hotkeys')[0].id).toBe('help.shortcuts')
  })

  it('matches loose subsequences', () => {
    const results = searchCommands('gt')
    expect(results.map((command) => command.id)).toContain('goto.today')
  })

  it('returns nothing for unmatched queries', () => {
    expect(searchCommands('xqz')).toEqual([])
  })
})

describe('Command history', () => {
  beforeEach(() => {
    clearCommandHistory()
  })

  it('records and loads usage', () => {
    const stored = recordCommandUsage(
      'goto.analytics',
      new Date('2026-10-06T12:00:00Z'),
    )

    expect(stored).toHaveLength(1)
    expect(stored[0]).toEqual({
      commandId: 'goto.analytics',
      count: 1,
      lastUsedAt: '2026-10-06T12:00:00.000Z',
    })
    expect(loadCommandHistory()).toEqual(stored)
  })

  it('increments the counter for repeated runs', () => {
    recordCommandUsage('goto.analytics', new Date('2026-10-06T12:00:00Z'))
    const updated = recordCommandUsage(
      'goto.analytics',
      new Date('2026-10-06T13:00:00Z'),
    )

    expect(updated[0].count).toBe(2)
    expect(updated[0].lastUsedAt).toBe('2026-10-06T13:00:00.000Z')
  })

  it('keeps other entries when recording', () => {
    recordCommandUsage('goto.today', new Date('2026-10-06T12:00:00Z'))
    recordCommandUsage('goto.analytics', new Date('2026-10-06T13:00:00Z'))

    expect(loadCommandHistory()).toHaveLength(2)
  })

  it('caps the stored history', () => {
    for (let i = 0; i < MAX_HISTORY + 10; i += 1) {
      recordCommandUsage(
        `command.${i}`,
        new Date(2026, 9, 6, 12, i),
      )
    }

    const loaded = loadCommandHistory()
    expect(loaded).toHaveLength(MAX_HISTORY)
    // The oldest entries are dropped.
    expect(loaded.some((usage) => usage.commandId === 'command.0')).toBe(false)
    expect(
      loaded.some((usage) => usage.commandId === `command.${MAX_HISTORY + 9}`),
    ).toBe(true)
  })

  it('sorts recent commands newest first', () => {
    recordCommandUsage('goto.today', new Date('2026-10-06T12:00:00Z'))
    recordCommandUsage('goto.analytics', new Date('2026-10-06T14:00:00Z'))
    recordCommandUsage('goto.all', new Date('2026-10-06T13:00:00Z'))

    const recent = getRecentCommands(loadCommandHistory())
    expect(recent.map((usage) => usage.commandId)).toEqual([
      'goto.analytics',
      'goto.all',
      'goto.today',
    ])
  })

  it('limits the recent list', () => {
    recordCommandUsage('goto.today', new Date('2026-10-06T12:00:00Z'))
    recordCommandUsage('goto.all', new Date('2026-10-06T13:00:00Z'))

    expect(getRecentCommands(loadCommandHistory(), 1)).toHaveLength(1)
  })

  it('drops malformed entries when loading', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { commandId: 'a', count: 2, lastUsedAt: '2026-01-01' },
        { commandId: 'b', count: 'many', lastUsedAt: '2026-01-01' },
        { count: 1, lastUsedAt: '2026-01-01' },
        'not-an-object',
      ]),
    )

    expect(parseCommandHistory(localStorage.getItem(STORAGE_KEY))).toEqual([
      { commandId: 'a', count: 2, lastUsedAt: '2026-01-01' },
    ])
  })

  it('returns an empty list for corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadCommandHistory()).toEqual([])
    expect(parseCommandHistory(null)).toEqual([])
    expect(parseCommandHistory('{"a":1}')).toEqual([])
  })
})

describe('Command suggestions', () => {
  const TUESDAY_MORNING = toCommandContext(new Date(2026, 9, 6, 9, 0))

  it('maps dates to a command context', () => {
    const context = toCommandContext(new Date(2026, 9, 6, 15, 30))
    expect(context.hourOfDay).toBe(15)
    expect(context.dayOfWeek).toBe(2) // 2026-10-06 is a Tuesday
  })

  it('suggests the day view in the morning', () => {
    const suggestions = suggestCommands(TUESDAY_MORNING, {
      history: [],
    })
    expect(suggestions[0].id).toBe('goto.today')
  })

  it('suggests analytics on Monday', () => {
    const monday = toCommandContext(new Date(2026, 9, 5, 9, 0))
    expect(monday.dayOfWeek).toBe(1)
    expect(suggestCommands(monday, { history: [] })[0].id).toBe(
      'goto.analytics',
    )
  })

  it('suggests analytics for the evening review', () => {
    const evening = toCommandContext(new Date(2026, 9, 6, 19, 0))
    expect(suggestCommands(evening, { history: [] })[0].id).toBe(
      'goto.analytics',
    )
  })

  it('suggests the upcoming view on Sunday evening', () => {
    const sundayEvening = toCommandContext(new Date(2026, 9, 4, 18, 0))
    expect(sundayEvening.dayOfWeek).toBe(0)
    expect(suggestCommands(sundayEvening, { history: [] })[0].id).toBe(
      'goto.upcoming',
    )
  })

  it('promotes frequently used commands', () => {
    const now = Date.UTC(2026, 9, 6, 9, 0)
    const history: CommandUsage[] = [
      {
        commandId: 'goto.workflows',
        count: 10,
        lastUsedAt: new Date(now).toISOString(),
      },
    ]

    const suggestions = suggestCommands(TUESDAY_MORNING, {
      history,
      now,
    })
    expect(suggestions[0].id).toBe('goto.workflows')
  })

  it('keeps heavily used commands suggested even when stale', () => {
    const now = Date.UTC(2026, 9, 6, 9, 0)
    const stale = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const history: CommandUsage[] = [
      {
        commandId: 'goto.workflows',
        count: 50,
        lastUsedAt: stale.toISOString(),
      },
    ]

    // Frequency is log-scaled, so a well-worn command
    // stays suggested even without recency.
    const suggestions = suggestCommands(TUESDAY_MORNING, {
      history,
      now,
    })
    expect(suggestions[0].id).toBe('goto.workflows')
  })

  it('boosts fresh usage above equally used stale commands', () => {
    const now = Date.UTC(2026, 9, 6, 9, 0)
    const stale = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const history: CommandUsage[] = [
      {
        commandId: 'goto.workflows',
        count: 1,
        lastUsedAt: stale.toISOString(),
      },
      {
        commandId: 'goto.all',
        count: 1,
        lastUsedAt: new Date(now).toISOString(),
      },
    ]

    const suggestions = suggestCommands(TUESDAY_MORNING, {
      history,
      now,
    })
    expect(
      suggestions.findIndex((command) => command.id === 'goto.all'),
    ).toBeLessThan(
      suggestions.findIndex((command) => command.id === 'goto.workflows'),
    )
  })

  it('blends frequency with recency', () => {
    const now = Date.UTC(2026, 9, 6, 9, 0)
    const yesterday = new Date(now - 24 * 60 * 60 * 1000)
    const history: CommandUsage[] = [
      {
        commandId: 'help.shortcuts',
        count: 3,
        lastUsedAt: yesterday.toISOString(),
      },
    ]

    const suggestions = suggestCommands(TUESDAY_MORNING, {
      history,
      now,
    })
    expect(suggestions.map((command) => command.id)).toContain(
      'help.shortcuts',
    )
  })

  it('respects the limit', () => {
    expect(suggestCommands(TUESDAY_MORNING, { history: [], limit: 2 })).toHaveLength(2)
  })

  it('ranks a custom command set', () => {
    const commands = COMMANDS.filter((command) =>
      command.id.startsWith('goto.'),
    )
    const suggestions = suggestCommands(TUESDAY_MORNING, {
      commands,
      history: [],
      limit: 2,
    })
    expect(suggestions).toHaveLength(2)
    expect(suggestions.every((command) => command.id.startsWith('goto.'))).toBe(
      true,
    )
  })
})

describe('Command lookup', () => {
  it('finds a command by id', () => {
    expect(findCommand('goto.today')?.title).toBe('Go to Today')
    expect(findCommand('nope')).toBeUndefined()
  })

  it('finds commands in a custom set', () => {
    const custom = [COMMANDS[0]]
    expect(findCommand(COMMANDS[0].id, custom)?.id).toBe(COMMANDS[0].id)
    expect(findCommand('goto.all', custom)).toBeUndefined()
  })
})
