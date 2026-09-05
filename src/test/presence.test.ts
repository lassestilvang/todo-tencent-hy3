import {
  recordPresence,
  getActivePresence,
  prunePresence,
  resetPresenceForTesting,
  PRESENCE_TTL_MS,
} from '@/lib/collaboration/presence'

beforeEach(() => {
  resetPresenceForTesting()
})

describe('presence registry', () => {
  it('records and lists presence', () => {
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'Alex',
      now: 1_000,
    })

    const presence = getActivePresence('ws-1', 1_000)

    expect(presence).toHaveLength(1)
    expect(presence[0]).toEqual({
      clientId: 'client-a',
      name: 'Alex',
      lastSeen: 1_000,
    })
  })

  it('refreshes an existing heartbeat', () => {
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'Alex',
      now: 1_000,
    })
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'Alex',
      now: 5_000,
    })

    const presence = getActivePresence('ws-1', 5_000)

    expect(presence).toHaveLength(1)
    expect(presence[0].lastSeen).toBe(5_000)
  })

  it('expires heartbeats after the TTL', () => {
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'Alex',
      now: 1_000,
    })

    expect(
      getActivePresence('ws-1', 1_000 + PRESENCE_TTL_MS)
    ).toHaveLength(0)
  })

  it('sorts the most recent first', () => {
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'Alex',
      now: 1_000,
    })
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-b',
      name: 'Sam',
      now: 2_000,
    })

    const presence = getActivePresence('ws-1', 2_000)

    expect(presence.map((entry) => entry.name)).toEqual(
      ['Sam', 'Alex']
    )
  })

  it('prunes stale entries and empty workspaces', () => {
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'Alex',
      now: 1_000,
    })
    recordPresence({
      workspaceId: 'ws-2',
      clientId: 'client-b',
      name: 'Sam',
      now: 100_000,
    })

    const prunedAt = 1_000 + PRESENCE_TTL_MS
    const pruned = prunePresence(prunedAt)

    expect(pruned).toBe(1)
    expect(getActivePresence('ws-1', prunedAt)).toHaveLength(0)
    expect(getActivePresence('ws-2', prunedAt)).toHaveLength(1)
  })

  it('keeps workspaces separate', () => {
    recordPresence({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'Alex',
      now: 1_000,
    })

    expect(getActivePresence('ws-2', 1_000)).toHaveLength(
      0
    )
  })
})
