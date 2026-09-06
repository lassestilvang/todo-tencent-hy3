'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { WorkspaceActivity } from '@/lib/workspaces'
import type { SharedFocusRoom } from '@/lib/focus/shared-focus-room'

interface RoomEvent {
  type: 'room_updated' | 'room_session_state' | 'room_session_complete'
  roomId: string
  payload: Record<string, unknown>
}

/**
 * Subscribe to Shared Focus Room events via the workspace SSE stream.
 *
 * The SSE channel broadcasts lightweight `WorkspaceActivity` events
 * (action: `room_*`). This hook parses those, emits a typed event
 * via the callback, and serves as the real-time glue between the
 * server-side room registry and the client UI.
 *
 * The client should call `mutate()` (from useSWR) on relevant events
 * to revalidate its local room state.
 */
export function useSharedFocusRoom(
  workspaceId: string | null,
  onEvent: (event: RoomEvent) => void
): void {
  // Keep the latest callback without reopening the stream
  const callbackRef = useRef(onEvent)

  useEffect(() => {
    callbackRef.current = onEvent
  })

  const parseRoomEvent = useCallback((activity: WorkspaceActivity): RoomEvent | null => {
    if (!activity.action.startsWith('room_')) return null

    let payload: Record<string, unknown> = {}
    try {
      payload = activity.details ? JSON.parse(activity.details) : {}
    } catch {
      // Malformed JSON — treat as empty payload
    }

    const typeMap: Record<string, RoomEvent['type']> = {
      room_updated: 'room_updated',
      room_session_state: 'room_session_state',
      room_session_complete: 'room_session_complete',
    }

    const type = typeMap[activity.action]
    if (!type) return null

    return { type, roomId: activity.entityId, payload }
  }, [])

  useEffect(() => {
    if (!workspaceId) return

    const source = new EventSource(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/events`
    )

    source.onmessage = (message) => {
      try {
        const activity = JSON.parse(message.data) as WorkspaceActivity
        const event = parseRoomEvent(activity)
        if (event) {
          callbackRef.current(event)
        }
      } catch {
        // Ignore malformed frames.
      }
    }

    return () => source.close()
  }, [workspaceId, parseRoomEvent])
}

// Re-export types for consumers
export type { SharedFocusRoom }
export type { RoomTimerMode } from '@/lib/focus/shared-focus-room'
