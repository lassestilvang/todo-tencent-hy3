'use client'

import { useEffect, useState } from 'react'
import type { PresenceEntry } from '@/lib/collaboration/presence'

const POLL_MS = 10_000
const HEARTBEAT_MS = 15_000

/**
 * Live presence for a workspace.
 *
 * Heartbeats every 15 seconds and polls the
 * active list every 10. `clientId` identifies
 * this device (there is no login, so presence
 * is per-device); `name` labels it.
 */
export function useWorkspacePresence(
  workspaceId: string | null,
  clientId: string,
  name: string
): PresenceEntry[] {
  // The last successful poll, tagged with
  // the workspace it belongs to. Deriving
  // the list from it means a workspace
  // switch shows no stale entries without
  // a reset effect.
  const [snapshot, setSnapshot] = useState<{
    workspaceId: string
    entries: PresenceEntry[]
  } | null>(null)

  const presence =
    snapshot !== null &&
    snapshot.workspaceId === workspaceId
      ? snapshot.entries
      : []

  useEffect(() => {
    if (!workspaceId) {
      return
    }

    let cancelled = false
    const listUrl = `/api/presence?workspaceId=${encodeURIComponent(
      workspaceId
    )}`

    const refresh = async () => {
      try {
        const response = await fetch(listUrl)
        if (!response.ok || cancelled) {
          return
        }
        const body = (await response.json()) as {
          presence: PresenceEntry[]
        }
        if (!cancelled) {
          setSnapshot({
            workspaceId,
            entries: body.presence,
          })
        }
      } catch {
        // Offline — the next poll retries.
      }
    }

    const heartbeat = async () => {
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            clientId,
            name,
          }),
          // Fire-and-forget: must not block
          // unmount or tab hide.
          keepalive: true,
        })
      } catch {
        // Offline — the next heartbeat retries.
      }
    }

    heartbeat()
    refresh()
    const poll = setInterval(refresh, POLL_MS)
    const beat = setInterval(heartbeat, HEARTBEAT_MS)

    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(beat)
    }
  }, [workspaceId, clientId, name])

  return presence
}
