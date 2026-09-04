/**
 * Saved filter presets
 *
 * A filter is a set of task-list criteria; a preset is a
 * named filter kept in localStorage. The matching logic
 * mirrors the server-side `getTasks` filters so a preset
 * applied through the URL produces the same result.
 */

import type { Task, Priority } from '@/types'

export type TaskView = 'today' | 'next7' | 'upcoming' | 'all'

export interface TaskFilter {
  view?: TaskView
  listId?: string
  labelId?: string
  priority?: Priority
  /** undefined means "show completed and active" */
  completed?: boolean
  /** Incomplete tasks dated or due before today */
  overdue?: boolean
  search?: string
}

export interface FilterPreset {
  id: string
  name: string
  filter: TaskFilter
  createdAt: string
}

const STORAGE_KEY = 'taskflow_filter_presets'

/** Keep a bounded number of presets. */
export const MAX_PRESETS = 20

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Whether a task matches every criterion of a filter.
 * Pass a fixed `now` to test the view windows.
 */
export function matchesFilter(
  task: Task,
  filter: TaskFilter,
  now: Date = new Date()
): boolean {
  if (filter.listId && task.list_id !== filter.listId) {
    return false
  }

  if (
    filter.labelId &&
    !task.labels?.some((label) => label.id === filter.labelId)
  ) {
    return false
  }

  if (filter.priority && task.priority !== filter.priority) {
    return false
  }

  if (filter.completed !== undefined && task.completed !== filter.completed) {
    return false
  }

  if (filter.overdue) {
    // An overdue task is incomplete and dated or due
    // before today — the same comparison the quick
    // actions panel uses.
    const date = task.date?.slice(0, 10)
    const deadline = task.deadline?.slice(0, 10)
    const today = toDateString(now)
    const isOverdue =
      !task.completed &&
      ((date !== undefined && date < today) ||
        (deadline !== undefined && deadline < today))
    if (!isOverdue) {
      return false
    }
  }

  if (filter.search) {
    const needle = filter.search.toLowerCase()
    const haystack = `${task.name} ${task.description ?? ''}`.toLowerCase()
    if (!haystack.includes(needle)) {
      return false
    }
  }

  if (filter.view) {
    // Dates are stored as ISO strings; compare the
    // `yyyy-MM-dd` prefix the same way the database does.
    const date = task.date?.slice(0, 10)
    const deadline = task.deadline?.slice(0, 10)
    const today = toDateString(now)
    const next7Days = toDateString(
      new Date(now.getTime() + 7 * 86_400_000)
    )

    switch (filter.view) {
      case 'today':
        if (date !== today && deadline !== today) {
          return false
        }
        break
      case 'next7':
        if (!date || date < today || date > next7Days) {
          return false
        }
        break
      case 'upcoming':
        if (!date || date < today) {
          return false
        }
        break
      case 'all':
        break
    }
  }

  return true
}

export function filterTasks(
  tasks: Task[],
  filter: TaskFilter,
  now: Date = new Date()
): Task[] {
  return tasks.filter((task) => matchesFilter(task, filter, now))
}

/** Serialize a filter into URL query parameters. */
export function filterToParams(filter: TaskFilter): Record<string, string> {
  const params: Record<string, string> = {}
  if (filter.view) params.view = filter.view
  if (filter.listId) params.listId = filter.listId
  if (filter.labelId) params.labelId = filter.labelId
  if (filter.priority) params.priority = filter.priority
  if (filter.completed !== undefined) {
    params.completed = String(filter.completed)
  }
  if (filter.overdue) {
    params.overdue = 'true'
  }
  if (filter.search) params.search = filter.search
  return params
}

/**
 * Parse a filter from URL query parameters.
 * Unknown values are dropped rather than trusted.
 */
export function paramsToFilter(
  params: Record<string, string | string[] | undefined>
): TaskFilter {
  const first = (key: string): string | undefined => {
    const raw = params[key]
    return Array.isArray(raw) ? raw[0] : raw
  }

  const filter: TaskFilter = {}

  const view = first('view')
  if (view === 'today' || view === 'next7' || view === 'upcoming' || view === 'all') {
    filter.view = view
  }

  const listId = first('listId')
  if (listId) filter.listId = listId

  const labelId = first('labelId')
  if (labelId) filter.labelId = labelId

  const priority = first('priority')
  if (
    priority === 'high' ||
    priority === 'medium' ||
    priority === 'low' ||
    priority === 'none'
  ) {
    filter.priority = priority
  }

  const completed = first('completed')
  if (completed === 'true') filter.completed = true
  else if (completed === 'false') filter.completed = false

  if (first('overdue') === 'true') filter.overdue = true

  const search = first('search')
  if (search) filter.search = search

  return filter
}

export function loadFilterPresets(): FilterPreset[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(raw)) {
      return []
    }
    return raw.filter(
      (entry): entry is FilterPreset =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.filter === 'object' &&
        entry.filter !== null &&
        typeof entry.createdAt === 'string'
    )
  } catch {
    return []
  }
}

/** Save a named filter, replacing a preset with the same name. */
export function saveFilterPreset(
  name: string,
  filter: TaskFilter
): FilterPreset {
  const presets = loadFilterPresets()
  const existing = presets.findIndex(
    (preset) => preset.name.toLowerCase() === name.toLowerCase()
  )

  const preset: FilterPreset = {
    id: existing >= 0 ? presets[existing].id : `preset-${Date.now()}`,
    name,
    filter,
    createdAt: existing >= 0 ? presets[existing].createdAt : new Date().toISOString(),
  }

  const next =
    existing >= 0
      ? presets.map((p) => (p.id === preset.id ? preset : p))
      : [...presets, preset].slice(-MAX_PRESETS)

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return preset
}

export function deleteFilterPreset(id: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const next = loadFilterPresets().filter((preset) => preset.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearFilterPresets(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(STORAGE_KEY)
}

/** All presets as JSON, for sharing between devices. */
export function exportFilterPresets(): string {
  return JSON.stringify(loadFilterPresets(), null, 2)
}

/**
 * Parse an exported presets file. Returns null
 * when the JSON is malformed; entries that do
 * not look like presets are skipped.
 */
export function parseImportedPresets(
  raw: string
): FilterPreset[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!Array.isArray(parsed)) {
    return null
  }

  const presets: FilterPreset[] = []
  for (const entry of parsed) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as FilterPreset).name === 'string' &&
      typeof (entry as FilterPreset).filter ===
        'object' &&
      (entry as FilterPreset).filter !== null
    ) {
      const source = entry as FilterPreset
      presets.push({
        id: `preset-${Date.now()}-${presets.length}`,
        name: source.name,
        filter: source.filter,
        createdAt:
          typeof source.createdAt === 'string'
            ? source.createdAt
            : new Date().toISOString(),
      })
    }
  }

  return presets
}

/**
 * Merge imported presets into an existing list,
 * replacing presets with the same (case-insensitive)
 * name. Returns at most `MAX_PRESETS` presets.
 */
export function mergeFilterPresets(
  existing: FilterPreset[],
  incoming: FilterPreset[]
): FilterPreset[] {
  const merged = [...existing]
  for (const preset of incoming) {
    const key = preset.name.toLowerCase()
    const index = merged.findIndex(
      (existingPreset) =>
        existingPreset.name.toLowerCase() === key
    )
    if (index >= 0) {
      merged[index] = preset
    } else {
      merged.push(preset)
    }
  }
  return merged.slice(-MAX_PRESETS)
}

/** Replace the stored presets wholesale (import). */
export function replaceFilterPresets(
  presets: FilterPreset[]
): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}
