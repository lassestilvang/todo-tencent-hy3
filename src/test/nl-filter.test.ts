import {
  describeFilter,
  hasFilterCriteria,
  parseFilterQuery,
} from '@/lib/nl-filter'

describe('Natural-language parsing', () => {
  it('returns an empty filter for an empty query', () => {
    expect(parseFilterQuery('')).toEqual({})
    expect(parseFilterQuery('   ')).toEqual({})
  })

  it('ignores filler words', () => {
    expect(parseFilterQuery('show me the tasks')).toEqual({})
    expect(parseFilterQuery('please find my tasks')).toEqual({})
  })

  it('parses completion status', () => {
    expect(parseFilterQuery('done tasks')).toEqual({
      completed: true,
    })
    expect(parseFilterQuery('completed')).toEqual({
      completed: true,
    })
    expect(parseFilterQuery('finished tasks')).toEqual({
      completed: true,
    })
    expect(parseFilterQuery('active tasks')).toEqual({
      completed: false,
    })
    expect(parseFilterQuery('open tasks')).toEqual({
      completed: false,
    })
    expect(parseFilterQuery('pending items')).toEqual({
      completed: false,
    })
  })

  it('negates the status that follows', () => {
    expect(parseFilterQuery('not done')).toEqual({
      completed: false,
    })
    expect(parseFilterQuery('hide completed')).toEqual({
      completed: false,
    })
    expect(parseFilterQuery('tasks not finished')).toEqual({
      completed: false,
    })
  })

  it('parses priority levels', () => {
    expect(parseFilterQuery('high priority tasks')).toEqual({
      priority: 'high',
    })
    expect(parseFilterQuery('top priority')).toEqual({
      priority: 'high',
    })
    expect(parseFilterQuery('urgent tasks')).toEqual({
      priority: 'high',
    })
    expect(parseFilterQuery('important items')).toEqual({
      priority: 'high',
    })
    expect(parseFilterQuery('critical tasks')).toEqual({
      priority: 'high',
    })
    expect(parseFilterQuery('p1 tasks')).toEqual({
      priority: 'high',
    })
    expect(parseFilterQuery('medium priority tasks')).toEqual({
      priority: 'medium',
    })
    expect(parseFilterQuery('normal tasks')).toEqual({
      priority: 'medium',
    })
    expect(parseFilterQuery('low priority tasks')).toEqual({
      priority: 'low',
    })
    expect(parseFilterQuery('p3 tasks')).toEqual({
      priority: 'low',
    })
    expect(parseFilterQuery('no priority tasks')).toEqual({
      priority: 'none',
    })
    expect(parseFilterQuery('unprioritized tasks')).toEqual({
      priority: 'none',
    })
  })

  it('parses time windows', () => {
    expect(parseFilterQuery('tasks due today')).toEqual({
      view: 'today',
    })
    expect(parseFilterQuery('today')).toEqual({
      view: 'today',
    })
    expect(parseFilterQuery('this week')).toEqual({
      view: 'next7',
    })
    expect(parseFilterQuery('next 7 days')).toEqual({
      view: 'next7',
    })
    expect(parseFilterQuery('next seven days')).toEqual({
      view: 'next7',
    })
    expect(parseFilterQuery('next week')).toEqual({
      view: 'next7',
    })
    expect(parseFilterQuery('week')).toEqual({
      view: 'next7',
    })
    expect(parseFilterQuery('upcoming tasks')).toEqual({
      view: 'upcoming',
    })
    expect(parseFilterQuery('future tasks')).toEqual({
      view: 'upcoming',
    })
    expect(parseFilterQuery('someday tasks')).toEqual({
      view: 'upcoming',
    })
    expect(parseFilterQuery('everything')).toEqual({
      view: 'all',
    })
  })

  it('parses overdue', () => {
    expect(parseFilterQuery('overdue tasks')).toEqual({
      overdue: true,
    })
    expect(parseFilterQuery('late items')).toEqual({
      overdue: true,
    })
  })

  it('combines criteria in one sentence', () => {
    expect(
      parseFilterQuery('show high priority tasks due today')
    ).toEqual({ priority: 'high', view: 'today' })

    expect(
      parseFilterQuery('not done high priority overdue tasks')
    ).toEqual({
      completed: false,
      priority: 'high',
      overdue: true,
    })

    expect(
      parseFilterQuery('urgent completed tasks this week')
    ).toEqual({
      priority: 'high',
      completed: true,
      view: 'next7',
    })
  })

  it('collects unrecognized words into the search field', () => {
    expect(parseFilterQuery('urgent report')).toEqual({
      priority: 'high',
      search: 'report',
    })
    expect(parseFilterQuery('write the report')).toEqual({
      search: 'write report',
    })
    expect(parseFilterQuery('report about launch')).toEqual({
      search: 'report about launch'
    })
  })

  it('normalizes case, hyphens and punctuation', () => {
    expect(
      parseFilterQuery('Show HIGH priority, tasks due TODAY!')
    ).toEqual({ priority: 'high', view: 'today' })
    expect(parseFilterQuery('high-priority tasks')).toEqual({
      priority: 'high',
    })
  })

  it('later criteria win over earlier ones', () => {
    expect(parseFilterQuery('high, medium')).toEqual({
      priority: 'medium',
    })
  })
})

describe('Filter description', () => {
  it('describes an empty filter as all tasks', () => {
    expect(describeFilter({})).toBe('all tasks')
  })

  it('describes each criterion', () => {
    expect(describeFilter({ completed: true })).toBe(
      'completed tasks'
    )
    expect(describeFilter({ completed: false })).toBe(
      'active tasks'
    )
    expect(describeFilter({ priority: 'high' })).toBe(
      'high-priority tasks'
    )
    expect(describeFilter({ priority: 'none' })).toBe(
      'unprioritized tasks'
    )
    expect(describeFilter({ view: 'today' })).toBe(
      'due today tasks'
    )
    expect(describeFilter({ view: 'next7' })).toBe(
      'due this week tasks'
    )
    expect(describeFilter({ view: 'upcoming' })).toBe(
      'upcoming tasks'
    )
    expect(describeFilter({ view: 'all' })).toBe('all tasks')
    expect(describeFilter({ overdue: true })).toBe(
      'overdue tasks'
    )
    expect(describeFilter({ search: 'report' })).toBe(
      '"report" tasks'
    )
  })

  it('joins every criterion', () => {
    expect(
      describeFilter({
        priority: 'high',
        completed: false,
        view: 'today',
        search: 'report',
      })
    ).toBe('high-priority due today active "report" tasks')
  })
})

describe('Filter criteria detection', () => {
  it('is false without structured criteria', () => {
    expect(hasFilterCriteria({})).toBe(false)
    // A keyword search alone is not a filter.
    expect(hasFilterCriteria({ search: 'report' })).toBe(false)
  })

  it('is true for any structured criterion', () => {
    expect(hasFilterCriteria({ view: 'today' })).toBe(true)
    expect(hasFilterCriteria({ priority: 'high' })).toBe(true)
    expect(hasFilterCriteria({ completed: false })).toBe(true)
    expect(hasFilterCriteria({ overdue: true })).toBe(true)
  })
})
