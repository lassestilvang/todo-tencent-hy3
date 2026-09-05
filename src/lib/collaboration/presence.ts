/**
 * Workspace presence: who is online right now.
 *
 * Clients heartbeat with a client-generated id
 * (there is no login in this app, so presence is
 * per-device, not per-account). An entry counts
 * as present until its heartbeat goes stale.
 * The registry is in-memory like the activity
 * stream — the deployment is single-process.
 */

export interface PresenceEntry {
  clientId: string
  name: string
  lastSeen: number
}

/** A heartbeat older than this means the client is gone. */
export const PRESENCE_TTL_MS = 60_000

const registry = new Map<
  string,
  Map<string, PresenceEntry>
>()

/** Record (or refresh) a client's presence in a workspace. */
export function recordPresence(input: {
  workspaceId: string
  clientId: string
  name: string
  now?: number
}): void {
  const { workspaceId, clientId, name } = input
  const now = input.now ?? Date.now()

  let clients = registry.get(workspaceId)
  if (!clients) {
    clients = new Map()
    registry.set(workspaceId, clients)
  }

  clients.set(clientId, { clientId, name, lastSeen: now })
}

/**
 * The clients currently present in a workspace:
 * heartbeated within `PRESENCE_TTL_MS`, most
 * recent first.
 */
export function getActivePresence(
  workspaceId: string,
  now: number = Date.now()
): PresenceEntry[] {
  const clients = registry.get(workspaceId)
  if (!clients) {
    return []
  }

  return [...clients.values()]
    .filter((entry) => now - entry.lastSeen < PRESENCE_TTL_MS)
    .sort((a, b) => b.lastSeen - a.lastSeen)
}

/** Drop stale entries so the registry stays bounded. */
export function prunePresence(
  now: number = Date.now()
): number {
  let pruned = 0

  for (const [workspaceId, clients] of registry) {
    for (const [clientId, entry] of clients) {
      if (now - entry.lastSeen >= PRESENCE_TTL_MS) {
        clients.delete(clientId)
        pruned++
      }
    }
    if (clients.size === 0) {
      registry.delete(workspaceId)
    }
  }

  return pruned
}

/** Test helper: drop every presence entry. */
export function resetPresenceForTesting(): void {
  registry.clear()
}
