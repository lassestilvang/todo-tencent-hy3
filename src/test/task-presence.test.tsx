import { render, waitFor } from '@testing-library/react'
import { TaskPresence } from '@/components/task-presence'
import type { PresenceEntry } from '@/lib/collaboration/presence'

const CLIENT_ID_KEY = 'taskflow-client-id'

interface Heartbeat {
  workspaceId: string
  clientId: string
  name: string
}

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
  heartbeats.length = 0
  localStorage.clear()
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
      const presence = (url as string).includes('ws-1')
        ? [entry('Alex Chen'), entry('Sam Lee')]
        : []
      return Promise.resolve({
        ok: true,
        json: async () => ({ presence }),
      })
    }
  )
  ;(globalThis as { fetch?: unknown }).fetch =
    fetchMock
})

afterAll(() => {
  ;(globalThis as { fetch?: unknown }).fetch =
    originalFetch
})

describe('TaskPresence', () => {
  it('renders nothing when no one is present', async () => {
    const { container } = render(
      <TaskPresence workspaceId="ws-empty" />
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalled()
    )

    expect(container.textContent).toBe('')
  })

  it('shows the count and device initials', async () => {
    const { container } = render(
      <TaskPresence workspaceId="ws-1" />
    )

    await waitFor(() =>
      expect(container.textContent).toContain(
        '2 active'
      )
    )

    expect(container.textContent).toContain('AC')
    expect(container.textContent).toContain('SL')
  })

  it('shows an overflow count past four devices', async () => {
    // The mock answers ws-1 with two devices;
    // point this render at a busy workspace by
    // seeding the response through the URL.
    const busy = [
      entry('One'),
      entry('Two'),
      entry('Three'),
      entry('Four'),
      entry('Five'),
      entry('Six'),
    ]
    fetchMock.mockImplementation(
      (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ presence: busy }),
        })
      }
    )

    const { container } = render(
      <TaskPresence workspaceId="ws-1" />
    )

    await waitFor(() =>
      expect(container.textContent).toContain(
        '6 active'
      )
    )

    // Only four initials fit; the rest collapse
    // into an overflow count.
    expect(container.textContent).toContain('+2')
  })

  it('heartbeats with the stored client id', async () => {
    localStorage.setItem(CLIENT_ID_KEY, 'my-client')

    render(<TaskPresence workspaceId="ws-1" />)

    await waitFor(() => expect(heartbeats.length).toBe(1))

    expect(heartbeats[0]).toEqual({
      workspaceId: 'ws-1',
      clientId: 'my-client',
      name: 'This device',
    })
  })

  it('creates and stores a client id when none exists', async () => {
    render(<TaskPresence workspaceId="ws-1" />)

    await waitFor(() => expect(heartbeats.length).toBe(1))

    const clientId = heartbeats[0].clientId
    expect(clientId).toBeTruthy()
    expect(localStorage.getItem(CLIENT_ID_KEY)).toBe(
      clientId
    )
  })
})
