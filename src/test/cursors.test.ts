/**
 * Cursor tracking tests.
 *
 * Tests the in-memory cursor registry and cleanup without
 * hitting any network endpoints.
 */

import {
  updateCursor,
  removeCursor,
  getActiveCursors,
  onCursorEvent,
  clearAllCursors,
  type CursorPosition,
} from '@/lib/collaboration/cursors'
import { resetActivityStream } from '@/lib/collaboration/activity-stream'

describe('cursors', () => {
  const workspaceId = 'ws-test-1'

  beforeEach(() => {
    resetActivityStream()
    clearAllCursors()
  })

  describe('updateCursor / getActiveCursors', () => {
    it('registers a new cursor', () => {
      const position: CursorPosition = {
        taskId: 'task-1',
        field: 'name',
        timestamp: Date.now(),
      }

      updateCursor(workspaceId, 'device-a', 'Alice', position)

      const cursors = getActiveCursors(workspaceId)
      expect(cursors).toHaveLength(1)
      expect(cursors[0].deviceId).toBe('device-a')
      expect(cursors[0].userName).toBe('Alice')
      expect(cursors[0].position.taskId).toBe('task-1')
    })

    it('updates an existing cursor', () => {
      updateCursor(workspaceId, 'device-a', 'Alice', {
        taskId: 'task-1',
        field: 'name',
        timestamp: Date.now(),
      })

      const updatedPosition: CursorPosition = {
        taskId: 'task-2',
        field: 'description',
        timestamp: Date.now(),
      }
      updateCursor(workspaceId, 'device-a', 'Alice', updatedPosition)

      const cursors = getActiveCursors(workspaceId)
      expect(cursors).toHaveLength(1)
      expect(cursors[0].position.taskId).toBe('task-2')
      expect(cursors[0].position.field).toBe('description')
    })

    it('supports multiple devices', () => {
      updateCursor(workspaceId, 'device-a', 'Alice', {
        taskId: 'task-1',
        field: null,
        timestamp: Date.now(),
      })
      updateCursor(workspaceId, 'device-b', 'Bob', {
        taskId: 'task-2',
        field: 'name',
        timestamp: Date.now(),
      })

      const cursors = getActiveCursors(workspaceId)
      expect(cursors).toHaveLength(2)
      const names = cursors.map((c) => c.userName).sort()
      expect(names).toEqual(['Alice', 'Bob'])
    })
  })

  describe('removeCursor', () => {
    it('removes a cursor', () => {
      updateCursor(workspaceId, 'device-a', 'Alice', {
        taskId: 'task-1',
        field: null,
        timestamp: Date.now(),
      })

      removeCursor(workspaceId, 'device-a')

      const cursors = getActiveCursors(workspaceId)
      expect(cursors).toHaveLength(0)
    })
  })

  describe('getActiveCursors', () => {
    it('does not prune cursors that were just registered even if position timestamp is old', () => {
      // The TTL is based on when the cursor was last seen (registered/updated),
      // not the position's timestamp field.
      updateCursor(workspaceId, 'device-a', 'Alice', {
        taskId: 'task-1',
        field: null,
        timestamp: Date.now() - 20000, // old position timestamp
      })

      // Create a fresh cursor
      updateCursor(workspaceId, 'device-b', 'Bob', {
        taskId: 'task-2',
        field: null,
        timestamp: Date.now(),
      })

      // Both cursors are active (registered recently)
      const cursors = getActiveCursors(workspaceId)
      expect(cursors).toHaveLength(2)
    })

    it('returns empty array for unknown workspace', () => {
      const cursors = getActiveCursors('nonexistent')
      expect(cursors).toHaveLength(0)
    })
  })

  describe('onCursorEvent', () => {
    it('receives events published to the activity stream', () => {
      const received: any[] = []
      const unsubscribe = onCursorEvent(workspaceId, (event) => {
        received.push(event)
      })

      updateCursor(workspaceId, 'device-a', 'Alice', {
        taskId: 'task-1',
        field: null,
        timestamp: Date.now(),
      })

      expect(received.length).toBe(1)
      expect(received[0].action).toBe('cursor_moved')
      expect(received[0].userName).toBe('Alice')

      unsubscribe()
    })
  })
})
