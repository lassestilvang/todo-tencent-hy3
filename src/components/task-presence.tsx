'use client'

import { useMemo } from 'react'
import { useWorkspacePresence } from '@/lib/use-workspace-presence'
import type { PresenceEntry } from '@/lib/collaboration/presence'

const CLIENT_ID_KEY = 'taskflow-client-id'

/** This device's stable id, created once. */
function getClientId(): string {
  if (typeof window === 'undefined') {
    return 'server'
  }
  const stored = localStorage.getItem(CLIENT_ID_KEY)
  if (stored) {
    return stored
  }
  const id =
    typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(CLIENT_ID_KEY, id)
  return id
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Presence indicators for the workspace a
 * task belongs to (the assignee's workspace).
 * Shows the devices currently active there,
 * including this one.
 */
export function TaskPresence({
  workspaceId,
}: {
  workspaceId: string
}) {
  const clientId = useMemo(() => getClientId(), [])
  const presence = useWorkspacePresence(
    workspaceId,
    clientId,
    'This device'
  )

  if (presence.length === 0) {
    return null
  }

  return (
    <div
      className="flex items-center gap-1.5"
      title="Devices active in this workspace"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-xs text-muted-foreground">
        {presence.length} active
      </span>
      <div className="flex -space-x-1">
        {presence.slice(0, 4).map(
          (entry: PresenceEntry) => (
            <span
              key={entry.clientId}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary ring-1 ring-background"
              title={entry.name}
            >
              {initials(entry.name)}
            </span>
          )
        )}
        {presence.length > 4 && (
          <span className="text-[10px] text-muted-foreground">
            +{presence.length - 4}
          </span>
        )}
      </div>
    </div>
  )
}
