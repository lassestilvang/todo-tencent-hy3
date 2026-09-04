'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { Radio } from 'lucide-react'
import { useWorkspaceEvents } from '@/lib/use-workspace-events'
import type { WorkspaceActivity } from '@/lib/workspaces'

const FEED_LIMIT = 10
const MAX_EVENTS = 20

async function fetcher(url: string): Promise<{
  activity: WorkspaceActivity[]
}> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch activity')
  }
  return response.json()
}

/**
 * Live workspace activity feed.
 *
 * Recent events load through the activity
 * API; events published while the page is
 * open arrive over the SSE stream and are
 * prepended as they happen, so the feed
 * updates without a refresh.
 */
export function WorkspaceActivityFeed({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data } = useSWR(
    `/api/workspaces/${encodeURIComponent(
      workspaceId
    )}/activity?limit=${FEED_LIMIT}`,
    fetcher
  )
  const [liveEvents, setLiveEvents] = useState<
    WorkspaceActivity[]
  >([])

  // Newest first, ignoring events the
  // loaded feed already contains (SWR
  // revalidates after a live event).
  useWorkspaceEvents(workspaceId, (event) => {
    setLiveEvents((previous) =>
      previous.some((entry) => entry.id === event.id)
        ? previous
        : [event, ...previous].slice(0, MAX_EVENTS)
    )
  })

  const events = useMemo(() => {
    const loaded = data?.activity ?? []
    const liveIds = new Set(
      liveEvents.map((entry) => entry.id)
    )
    return [
      ...liveEvents,
      ...loaded.filter(
        (entry) => !liveIds.has(entry.id)
      ),
    ].slice(0, MAX_EVENTS)
  }, [liveEvents, data])

  if (events.length === 0) {
    return null
  }

  return (
    <div>
      <span className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
        <Radio className="text-emerald-500 h-3.5 w-3.5" />
        Live activity
      </span>
      <div className="bg-accent/5 border-border/5 max-h-40 space-y-1.5 overflow-auto rounded-xl border p-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="text-muted-foreground/80 border-border/5 flex items-baseline gap-2 border-b pb-1.5 text-xs last:border-0"
          >
            <span className="text-foreground/80 min-w-0 flex-1 font-medium">
              {event.details}
            </span>
            <span className="text-muted-foreground/60 shrink-0">
              {formatDistanceToNow(event.createdAt)} ago
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
