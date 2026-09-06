/**
 * Shared cursor tracking for collaborative editing.
 *
 * Uses the existing in-memory activity stream infrastructure to
 * broadcast cursor positions between collaborators in real time.
 * Each client reports its cursor position (which task they're viewing
 * or editing) and other clients receive updates for live cursor indicators.
 *
 * Cursor data is ephemeral — stored in-memory with a TTL, and
 * never persisted to the database.
 */

import { publishActivity, subscribeToWorkspace, type ActivityListener } from './activity-stream'

export interface CursorPosition {
  /** Task ID the cursor is on */
  taskId: string | null
  /** Field being edited (if any) */
  field: string | null
  /** Selection range in the field (if applicable) */
  selectionStart?: number
  /** Epoch ms of last update */
  timestamp: number
}

export interface CursorState {
  /** Device/session identifier */
  deviceId: string
  /** User display name or email */
  userName: string
  /** Current cursor position */
  position: CursorPosition
  /** When this cursor was last seen */
  lastSeen: number
}

/** A cursor activity event, compatible with the WorkspaceActivity shape. */
interface CursorEvent {
  id: string
  workspaceId: string
  userId: string
  userName: string
  action: 'cursor_moved' | 'cursor_left'
  details: string
  entityType: 'task' | 'list' | 'member' | 'invitation' | 'comment' | 'workspace'
  entityId: string
  createdAt: number
  data?: CursorPosition
}

const CURSOR_TTL = 15000 // 15 seconds — cursors expire if not updated
const cursors = new Map<string, Map<string, CursorState>>()

/**
 * Register or update a cursor position for a device.
 * Broadcasts the position to other collaborators via the activity stream.
 */
export function updateCursor(
  workspaceId: string,
  deviceId: string,
  userName: string,
  position: CursorPosition,
): void {
  if (!cursors.has(workspaceId)) {
    cursors.set(workspaceId, new Map())
  }

  const workspaceCursors = cursors.get(workspaceId)!
  workspaceCursors.set(deviceId, {
    deviceId,
    userName,
    position,
    lastSeen: Date.now(),
  })

  // Broadcast to other collaborators via the activity stream
  const activity: CursorEvent = {
    id: `cursor-${deviceId}-${Date.now()}`,
    workspaceId,
    userId: deviceId,
    userName,
    action: 'cursor_moved',
    details: JSON.stringify(position),
    entityType: 'task',
    entityId: position.taskId || '',
    createdAt: Date.now(),
    data: position,
  }
  publishActivity(activity as any)
}

/**
 * Remove a cursor (e.g., on disconnect or tab close).
 */
export function removeCursor(workspaceId: string, deviceId: string): void {
  const workspaceCursors = cursors.get(workspaceId)
  if (workspaceCursors) {
    workspaceCursors.delete(deviceId)

    const leaveActivity: CursorEvent = {
      id: `cursor-leave-${deviceId}-${Date.now()}`,
      workspaceId,
      userId: deviceId,
      userName: '',
      action: 'cursor_left',
      details: '',
      entityType: 'task',
      entityId: '',
      createdAt: Date.now(),
      data: { taskId: null, field: null, timestamp: Date.now() },
    }
    publishActivity(leaveActivity as any)
  }
}

/**
 * Get all active cursors for a workspace (expired cursors are pruned).
 */
export function getActiveCursors(workspaceId: string): CursorState[] {
  const workspaceCursors = cursors.get(workspaceId)
  if (!workspaceCursors) return []

  const now = Date.now()
  const active: CursorState[] = []

  for (const [_, state] of workspaceCursors) {
    if (now - state.lastSeen < CURSOR_TTL) {
      active.push(state)
    } else {
      workspaceCursors.delete(state.deviceId)
    }
  }

  return active
}

/**
 * Prune expired cursors periodically.
 * Call once at app startup to keep memory bounded.
 */
export function startCursorCleanup(): NodeJS.Timeout | undefined {
  if (typeof setInterval === 'undefined') return undefined
  return setInterval(() => {
    const now = Date.now()
    for (const [workspaceId, workspaceCursors] of cursors) {
      for (const [deviceId, state] of workspaceCursors) {
        if (now - state.lastSeen >= CURSOR_TTL) {
          workspaceCursors.delete(deviceId)
        }
      }
      if (workspaceCursors.size === 0) {
        cursors.delete(workspaceId)
      }
    }
  }, 30000)
}

/**
 * Clear all cursor state. Test helper.
 */
export function clearAllCursors(): void {
  cursors.clear()
}

/**
 * Subscribe to cursor events for a workspace.
 * Returns an unsubscribe function.
 */
export function onCursorEvent(
  workspaceId: string,
  callback: ActivityListener,
): () => void {
  return subscribeToWorkspace(workspaceId, callback)
}
