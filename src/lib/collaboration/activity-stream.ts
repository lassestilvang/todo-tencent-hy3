/**
 * In-memory pub/sub for workspace activity.
 *
 * The deployment is single-process (see the proxy
 * notes), so module state is the right scope for
 * the subscriber registry: every route handler
 * and store import shares it. This is the
 * dependency-free equivalent of a websocket
 * broadcast for the server -> client direction.
 */

import type { WorkspaceActivity } from '@/lib/workspaces'

export type ActivityListener = (
  event: WorkspaceActivity
) => void

const listeners = new Map<string, Set<ActivityListener>>()

/**
 * Deliver activity for a workspace to `listener`
 * until the returned unsubscribe function runs.
 */
export function subscribeToWorkspace(
  workspaceId: string,
  listener: ActivityListener
): () => void {
  let set = listeners.get(workspaceId)
  if (!set) {
    set = new Set()
    listeners.set(workspaceId, set)
  }
  set.add(listener)

  return () => {
    set!.delete(listener)
    if (set!.size === 0) {
      listeners.delete(workspaceId)
    }
  }
}

/** Broadcast an activity to every subscriber of its workspace. */
export function publishActivity(event: WorkspaceActivity): void {
  listeners.get(event.workspaceId)?.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // A broken listener must not break the
      // broadcast for the others.
    }
  })
}

/** The workspaces that currently have subscribers. */
export function subscribedWorkspaces(): string[] {
  return [...listeners.keys()]
}

/** Test helper: drop every subscriber. */
export function resetActivityStream(): void {
  listeners.clear()
}
