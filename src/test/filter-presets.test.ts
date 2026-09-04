import {
  matchesFilter,
  filterTasks,
  filterToParams,
  paramsToFilter,
  loadFilterPresets,
  saveFilterPreset,
  deleteFilterPreset,
  clearFilterPresets,
  exportFilterPresets,
  parseImportedPresets,
  mergeFilterPresets,
  replaceFilterPresets,
  MAX_PRESETS,
  type FilterPreset,
} from '@/lib/filter-presets'
import type { Task, Label } from '@/types'

const STORAGE_KEY = 'taskflow_filter_presets'

// 2026-10-06 is a Monday; the windows below are
// relative to it.
const NOW = new Date(2026, 9, 6, 12, 0)
const TODAY = '2026-10-06'
const TOMORROW = '2026-10-07'
const NEXT_WEEK = '2026-10-13'
const PAST = '2026-10-01'

function label(overrides: Partial<Label> = {}): Label {
  return {
    id: 'label-1',
    name: 'Work',
    color: '#6366f1',
    icon: '',
    created_at: '2026-01-01T00:00:00',
    ...overrides,
  }
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Write report',
    description: null,
    date: null,
    deadline: null,
    estimate: null,
    actual_time: 0,
    priority: 'none',
    recurring: null as unknown as Task['recurring'],
    list_id: 'inbox',
    parent_task_id: null,
    completed: false,
    completed_at: null,
    position: 0,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  }
}

describe('Filter matching', () => {
  it('matches every task for the all view', () => {
    expect(matchesFilter(task({ date: PAST }), { view: 'all' }, NOW)).toBe(true)
    expect(matchesFilter(task(), { view: 'all' }, NOW)).toBe(true)
  })

  it('matches tasks dated or due today for the today view', () => {
    expect(
      matchesFilter(task({ date: TODAY }), { view: 'today' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ deadline: TODAY }), { view: 'today' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ date: TOMORROW }), { view: 'today' }, NOW)
    ).toBe(false)
    expect(
      matchesFilter(task(), { view: 'today' }, NOW)
    ).toBe(false)
  })

  it('matches the 7-day window for the next7 view', () => {
    expect(
      matchesFilter(task({ date: TODAY }), { view: 'next7' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ date: NEXT_WEEK }), { view: 'next7' }, NOW)
    ).toBe(true)
    // One day past the window.
    expect(
      matchesFilter(
        task({ date: '2026-10-14' }),
        { view: 'next7' },
        NOW
      )
    ).toBe(false)
    expect(
      matchesFilter(task({ date: PAST }), { view: 'next7' }, NOW)
    ).toBe(false)
    expect(
      matchesFilter(task(), { view: 'next7' }, NOW)
    ).toBe(false)
  })

  it('matches future-dated tasks for the upcoming view', () => {
    expect(
      matchesFilter(task({ date: TOMORROW }), { view: 'upcoming' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ date: TODAY }), { view: 'upcoming' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ date: PAST }), { view: 'upcoming' }, NOW)
    ).toBe(false)
    expect(
      matchesFilter(task(), { view: 'upcoming' }, NOW)
    ).toBe(false)
  })

  it('filters by list', () => {
    expect(
      matchesFilter(task({ list_id: 'work' }), { listId: 'work' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ list_id: 'inbox' }), { listId: 'work' }, NOW)
    ).toBe(false)
  })

  it('filters by label', () => {
    const work = label({ id: 'work' })
    expect(
      matchesFilter(task({ labels: [work] }), { labelId: 'work' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ labels: [label()] }), { labelId: 'work' }, NOW)
    ).toBe(false)
    expect(
      matchesFilter(task(), { labelId: 'work' }, NOW)
    ).toBe(false)
  })

  it('filters by priority', () => {
    expect(
      matchesFilter(task({ priority: 'high' }), { priority: 'high' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ priority: 'low' }), { priority: 'high' }, NOW)
    ).toBe(false)
  })

  it('filters by completion', () => {
    expect(
      matchesFilter(task({ completed: true }), { completed: true }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ completed: false }), { completed: true }, NOW)
    ).toBe(false)
    // An undefined completed criterion matches both.
    expect(
      matchesFilter(task({ completed: true }), {}, NOW)
    ).toBe(true)
  })

  it('filters by overdue', () => {
    expect(
      matchesFilter(task({ date: PAST }), { overdue: true }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ deadline: PAST }), { overdue: true }, NOW)
    ).toBe(true)
    // Today is not before today.
    expect(
      matchesFilter(task({ date: TODAY }), { overdue: true }, NOW)
    ).toBe(false)
    // Future-dated and undated tasks are not overdue.
    expect(
      matchesFilter(task({ date: TOMORROW }), { overdue: true }, NOW)
    ).toBe(false)
    expect(
      matchesFilter(task(), { overdue: true }, NOW)
    ).toBe(false)
    // Completed tasks are never overdue.
    expect(
      matchesFilter(
        task({ date: PAST, completed: true }),
        { overdue: true },
        NOW
      )
    ).toBe(false)
  })

  it('filters by search text in the name and description', () => {
    expect(
      matchesFilter(task({ name: 'Write report' }), { search: 'report' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(task({ name: 'Write report' }), { search: 'REPORT' }, NOW)
    ).toBe(true)
    expect(
      matchesFilter(
        task({ name: 'Chore', description: 'includes report notes' }),
        { search: 'report' },
        NOW
      )
    ).toBe(true)
    expect(
      matchesFilter(task({ name: 'Chore' }), { search: 'report' }, NOW)
    ).toBe(false)
  })

  it('requires every criterion to match', () => {
    const candidate = task({
      list_id: 'work',
      priority: 'high',
      date: TODAY,
      completed: false,
    })

    expect(
      matchesFilter(
        candidate,
        { view: 'today', listId: 'work', priority: 'high' },
        NOW
      )
    ).toBe(true)
    expect(
      matchesFilter(
        candidate,
        { view: 'today', listId: 'work', priority: 'low' },
        NOW
      )
    ).toBe(false)
  })

  it('filters a task list, keeping the order', () => {
    const tasks = [
      task({ id: 'a', name: 'Alpha', list_id: 'work', date: TODAY }),
      task({ id: 'b', name: 'Beta', list_id: 'home', date: TODAY }),
      task({ id: 'c', name: 'Gamma', list_id: 'work', date: PAST }),
    ]

    const result = filterTasks(tasks, { listId: 'work' }, NOW)

    expect(result.map((t) => t.id)).toEqual(['a', 'c'])
  })
})

describe('Filter serialization', () => {
  it('omits unset criteria', () => {
    expect(filterToParams({})).toEqual({})
    expect(
      filterToParams({ view: 'today', listId: 'work' })
    ).toEqual({ view: 'today', listId: 'work' })
  })

  it('serializes every criterion', () => {
    const params = filterToParams({
      view: 'next7',
      listId: 'work',
      labelId: 'label-1',
      priority: 'high',
      completed: false,
      search: 'report',
    })

    expect(params).toEqual({
      view: 'next7',
      listId: 'work',
      labelId: 'label-1',
      priority: 'high',
      completed: 'false',
      search: 'report',
    })
  })

  it('parses a filter from parameters', () => {
    expect(
      paramsToFilter({
        view: 'upcoming',
        listId: 'work',
        labelId: 'label-1',
        priority: 'medium',
        completed: 'true',
        search: 'report',
      })
    ).toEqual({
      view: 'upcoming',
      listId: 'work',
      labelId: 'label-1',
      priority: 'medium',
      completed: true,
      search: 'report',
    })
  })

  it('drops unknown values instead of trusting them', () => {
    expect(
      paramsToFilter({
        view: 'someday',
        priority: 'critical',
        completed: 'maybe',
      })
    ).toEqual({})
  })

  it('round-trips a filter through parameters', () => {
    const filter = {
      view: 'today',
      listId: 'work',
      labelId: 'label-1',
      priority: 'low',
      completed: false,
      search: 'report',
    } as const

    expect(paramsToFilter(filterToParams(filter))).toEqual(filter)
  })

  it('serializes and parses the overdue criterion', () => {
    expect(filterToParams({ overdue: true })).toEqual({
      overdue: 'true',
    })
    expect(paramsToFilter({ overdue: 'true' })).toEqual({
      overdue: true,
    })
    expect(paramsToFilter({ overdue: 'false' })).toEqual({})
  })

  it('round-trips an overdue filter through parameters', () => {
    const filter = {
      completed: false,
      overdue: true,
      priority: 'high',
    } as const

    expect(paramsToFilter(filterToParams(filter))).toEqual(
      filter
    )
  })
})

describe('Filter preset storage', () => {
  beforeEach(() => {
    clearFilterPresets()
  })

  it('saves and loads presets', () => {
    const saved = saveFilterPreset('Urgent work', {
      view: 'today',
      listId: 'work',
      priority: 'high',
    })

    const loaded = loadFilterPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toMatchObject({
      id: saved.id,
      name: 'Urgent work',
      filter: { view: 'today', listId: 'work', priority: 'high' },
    })
    expect(typeof loaded[0].createdAt).toBe('string')
  })

  it('replaces a preset with the same name, keeping its id', () => {
    const first = saveFilterPreset('Morning', { view: 'today' })
    const second = saveFilterPreset('Morning', { view: 'next7' })

    expect(second.id).toBe(first.id)

    const loaded = loadFilterPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].filter).toEqual({ view: 'next7' })
  })

  it('matches preset names case-insensitively', () => {
    saveFilterPreset('Morning', { view: 'today' })
    saveFilterPreset('MORNING', { view: 'upcoming' })

    expect(loadFilterPresets()).toHaveLength(1)
  })

  it('deletes a preset', () => {
    const saved = saveFilterPreset('Temporary', { view: 'all' })

    deleteFilterPreset(saved.id)

    expect(loadFilterPresets()).toHaveLength(0)
  })

  it('caps the number of stored presets', () => {
    for (let i = 0; i < MAX_PRESETS + 5; i++) {
      saveFilterPreset(`Preset ${i}`, { view: 'all' })
    }

    const loaded = loadFilterPresets()
    expect(loaded).toHaveLength(MAX_PRESETS)
    // The oldest entries are dropped.
    expect(loaded.some((p) => p.name === 'Preset 0')).toBe(false)
    expect(loaded.some((p) => p.name === `Preset ${MAX_PRESETS + 4}`)).toBe(true)
  })

  it('drops malformed entries when loading', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', name: 'Good', filter: {}, createdAt: '2026-01-01' },
        { id: 'b', name: 42, filter: {}, createdAt: '2026-01-01' },
        { name: 'No id', filter: {}, createdAt: '2026-01-01' },
        'not-an-object',
      ])
    )

    const loaded = loadFilterPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Good')
  })

  it('returns an empty list for corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadFilterPresets()).toEqual([])
  })
})

describe('Preset sharing', () => {
  beforeEach(() => {
    clearFilterPresets()
  })

  it('exports stored presets as JSON', () => {
    saveFilterPreset('Urgent', { priority: 'high' })

    const exported = JSON.parse(exportFilterPresets())

    expect(exported).toHaveLength(1)
    expect(exported[0].name).toBe('Urgent')
    expect(exported[0].filter).toEqual({
      priority: 'high',
    })
  })

  it('parses a valid presets file', () => {
    const raw = JSON.stringify([
      {
        name: 'Urgent',
        filter: { priority: 'high' },
        createdAt: '2026-01-01T00:00:00',
      },
      { name: 'Later', filter: { view: 'upcoming' } },
    ])

    const parsed = parseImportedPresets(raw)

    expect(parsed).not.toBeNull()
    expect(parsed!.map((preset) => preset.name)).toEqual([
      'Urgent',
      'Later',
    ])
    expect(parsed![0].filter).toEqual({
      priority: 'high',
    })
    // Missing ids and timestamps are filled in.
    expect(typeof parsed![1].id).toBe('string')
    expect(typeof parsed![1].createdAt).toBe('string')
  })

  it('returns null for malformed input', () => {
    expect(parseImportedPresets('{not json')).toBeNull()
    // Valid JSON that is not a list.
    expect(parseImportedPresets('{"name": "x"}')).toBeNull()
  })

  it('accepts an empty presets file', () => {
    expect(parseImportedPresets('[]')).toEqual([])
  })

  it('skips entries that are not presets', () => {
    const raw = JSON.stringify([
      { name: 'Good', filter: {} },
      { filter: {} },
      'not-an-object',
      { name: 'No filter' },
    ])

    const parsed = parseImportedPresets(raw)

    expect(parsed!.map((preset) => preset.name)).toEqual([
      'Good',
    ])
  })

  it('merges imports, replacing same-named presets', () => {
    const existing: FilterPreset[] = [
      {
        id: 'a',
        name: 'Morning',
        filter: { view: 'today' },
        createdAt: '2026-01-01T00:00:00',
      },
      {
        id: 'b',
        name: 'Work',
        filter: { listId: 'work' },
        createdAt: '2026-01-01T00:00:00',
      },
    ]
    const incoming: FilterPreset[] = [
      {
        id: 'c',
        name: 'MORNING',
        filter: { view: 'next7' },
        createdAt: '2026-02-01T00:00:00',
      },
      {
        id: 'd',
        name: 'Home',
        filter: { listId: 'home' },
        createdAt: '2026-02-01T00:00:00',
      },
    ]

    const merged = mergeFilterPresets(existing, incoming)

    expect(
      merged.map((preset) => preset.name).sort()
    ).toEqual(['Home', 'MORNING', 'Work'])
    const morning = merged.find(
      (preset) => preset.name === 'MORNING'
    )
    expect(morning?.filter).toEqual({ view: 'next7' })
  })

  it('caps merged presets at the maximum', () => {
    const existing: FilterPreset[] = Array.from(
      { length: MAX_PRESETS },
      (_, index) => ({
        id: `e-${index}`,
        name: `E ${index}`,
        filter: {},
        createdAt: '2026-01-01T00:00:00',
      })
    )
    const incoming: FilterPreset[] = [
      {
        id: 'new',
        name: 'Newest',
        filter: {},
        createdAt: '2026-02-01T00:00:00',
      },
    ]

    const merged = mergeFilterPresets(existing, incoming)

    expect(merged).toHaveLength(MAX_PRESETS)
    // The oldest entry is dropped for the import.
    expect(merged.some((preset) => preset.name === 'E 0')).toBe(
      false
    )
    expect(
      merged.some((preset) => preset.name === 'Newest')
    ).toBe(true)
  })

  it('replaces the stored presets wholesale', () => {
    saveFilterPreset('Old', { view: 'all' })

    const next: FilterPreset[] = [
      {
        id: 'n',
        name: 'New',
        filter: { priority: 'high' },
        createdAt: '2026-01-01T00:00:00',
      },
    ]
    replaceFilterPresets(next)

    const loaded = loadFilterPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('New')
  })
})
