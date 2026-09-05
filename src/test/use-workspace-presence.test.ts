import { renderHook, act } from '@testing-library/react'
import { useWorkspacePresence } from '@/lib/use-workspace-presence'
import type { PresenceEntry } from '@/lib/collaboration/presence'

const LIST_URL = '/api/presence?workspaceId=ws-1'

interface Heartbeat {
  workspaceId: string
  clientId: string
  name: string
}

// Per-workspace presence the mocked
// list endpoint answers with.
let presenceByWorkspace: Record<string, PresenceEntry[]>
const heartbeats: Heartbeat[] = []
const fetchMock = jest.fn()
const originalFetch = globalThis.fetch

function entry(name: string): PresenceEntry {
  return {
    clientId: `client-${name}`,
    name,
    lastSeen: Date.now(),
  }
}

beforeEach(() => {
  presenceByWorkspace = {
    'ws-1': [entry('Alex'), entry('Sam')],
    'ws-2': [entry('Jordan')],
  }
  heartbeats.length = 0
  fetchMock.mockReset()
  fetchMock.mockImplementation(
    (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        heartbeats.push(
          JSON.parse(String(init.body)) as Heartbeat
        )
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        })
      }
      const workspaceId = new URL(
        url,
        'https://taskflow.test'
      ).searchParams.get('workspaceId')
      return Promise.resolve({
        ok: true,
        json: async () => ({
          presence:
            presenceByWorkspace[workspaceId ?? ''] ??
            [],
        }),
      })
    }
  )
  ;(globalThis as { fetch?: unknown }).fetch =
    fetchMock
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

afterAll(() => {
  ;(globalThis as { fetch?: unknown }).fetch =
    originalFetch
})

/** Flush microtasks (and timers, when due). */
async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

function listCalls(): number {
  return fetchMock.mock.calls.filter(
    (call) => call[0] === LIST_URL
  ).length
}

function heartbeatCalls(): number {
  return fetchMock.mock.calls.filter(
    (call) =>
      call[0] === '/api/presence' &&
      (call[1] as RequestInit | undefined)?.method ===
        'POST'
  ).length
}

describe('useWorkspacePresence', () => {
  it('loads the active list on mount', async () => {
    const { result } = renderHook(() =>
      useWorkspacePresence(
        'ws-1',
        'client-a',
        'This device'
      )
    )

    // The list has not resolved yet.
    expect(result.current).toEqual([])

    await flush()

    expect(result.current.map((e) => e.name)).toEqual(
      ['Alex', 'Sam']
    )
  })

  it('heartbeats and polls on a schedule', async () => {
    const { result } = renderHook(() =>
      useWorkspacePresence(
        'ws-1',
        'client-a',
        'This device'
      )
    )
    await flush()

    const listsAfterMount = listCalls()
    const beatsAfterMount = heartbeatCalls()
    expect(result.current).toHaveLength(2)

    // The 10s poll refreshes the list…
    await flush(10_000)
    expect(listCalls()).toBe(listsAfterMount + 1)

    // …and the 15s heartbeat re-registers.
    await flush(5_000)
    expect(heartbeatCalls()).toBe(beatsAfterMount + 1)
    expect(heartbeats[heartbeats.length - 1]).toEqual({
      workspaceId: 'ws-1',
      clientId: 'client-a',
      name: 'This device',
    })
  })

  it('stops polling and heartbeating after unmount', async () => {
    const { unmount } = renderHook(() =>
      useWorkspacePresence(
        'ws-1',
        'client-a',
        'This device'
      )
    )
    await flush()

    unmount()

    const listsAfterUnmount = listCalls()
    const beatsAfterUnmount = heartbeatCalls()
    await flush(60_000)

    expect(listCalls()).toBe(listsAfterUnmount)
    expect(heartbeatCalls()).toBe(beatsAfterUnmount)
  })

  it('shows nothing from a previous workspace', async () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string | null }) =>
        useWorkspacePresence(
          workspaceId,
          'client-a',
          'This device'
        ),
      { initialProps: { workspaceId: 'ws-1' as string | null } }
    )
    await flush()
    expect(result.current).toHaveLength(2)

    // Switching workspaces: the old workspace's
    // entries must not leak into the new one.
    rerender({ workspaceId: 'ws-2' })
    expect(result.current).toEqual([])

    await flush()
    expect(result.current.map((e) => e.name)).toEqual([
      'Jordan',
    ])
  })

  it('keeps the last list when a poll fails', async () => {
    const { result } = renderHook(() =>
      useWorkspacePresence(
        'ws-1',
        'client-a',
        'This device'
      )
    )
    await flush()
    expect(result.current).toHaveLength(2)

    // Offline: the list endpoint now fails.
    fetchMock.mockImplementation(
      (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          })
        }
        return Promise.reject(new Error('offline'))
      }
    )

    await flush(10_000)

    expect(result.current).toHaveLength(2)
  })

  it('returns an empty list without a workspace', async () => {
    const { result } = renderHook(() =>
      useWorkspacePresence(
        null,
        'client-a',
        'This device'
      )
    )
    await flush(60_000)

    expect(result.current).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
