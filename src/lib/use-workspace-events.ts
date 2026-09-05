'use client'

import { useEffect, useRef } from 'react'
import type { WorkspaceActivity } from '@/lib/workspaces'

/**
 * Live workspace activity over server-sent events.
 *
 * EventSource reconnects on its own; the effect
 * closes the stream on unmount or when the
 * workspace changes.
 */
export function useWorkspaceEvents(
  workspaceId: string | null,
  onEvent: (event: WorkspaceActivity) => void
): void {
  // Keep the latest callback without
  // re-opening the stream per render.
  const callbackRef = useRef(onEvent)
  useEffect(() => {
    callbackRef.current = onEvent
  })

  useEffect(() => {
    if (!workspaceId) {
      return
    }

    const source = new EventSource(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/events`
    )

    source.onmessage = (message) => {
      try {
        callbackRef.current(
          JSON.parse(message.data)
        )
      } catch {
        // Ignore malformed frames.
      }
    }

    return () => source.close()
  }, [workspaceId])
}
