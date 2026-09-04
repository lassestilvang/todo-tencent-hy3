/**
 * @jest-environment node
 *
 * Without a DOM there is no `window` and no `localStorage`,
 * which is what a server route sees. The session log must
 * degrade to no-ops instead of crashing.
 */

import {
  loadFocusSessions,
  recordFocusSession,
  clearFocusSessions,
} from '@/lib/focus/session-log'

describe('Focus session log without a DOM', () => {
  it('should load an empty log', () => {
    expect(loadFocusSessions()).toEqual([])
  })

  it('should treat recording and clearing as no-ops', () => {
    expect(() => {
      recordFocusSession({ date: '2026-10-06', durationMinutes: 25, completed: true })
      clearFocusSessions()
    }).not.toThrow()

    expect(loadFocusSessions()).toEqual([])
  })
})
