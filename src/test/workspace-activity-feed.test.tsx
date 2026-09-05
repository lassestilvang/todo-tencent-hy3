import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type { ReactElement } from 'react'
import { WorkspaceActivityFeed } from '@/components/workspace-activity-feed'
import type { WorkspaceActivity } from '@/lib/workspaces'

interface EmittedMessage {
  data: string
}

type MessageHandler = (message: EmittedMessage) => void

/** Stand-in for EventSource (jsdom has none). */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: MessageHandler | null = null
  closed = false

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  close(): void {
    this.closed = true
  }

  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

interface Rendered {
  container: HTMLElement
  unmount: () => Promise<void>
}

/** Render into a detached container inside act(). */
async function render(
  ui: ReactElement
): Promise<Rendered> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  await act(async () => {
    root.render(ui)
  })

  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

/** Let pending fetches and effects settle. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function activity(
  id: string,
  details: string,
  workspaceId = 'ws-1'
): WorkspaceActivity {
  return {
    id,
    workspaceId,
    userId: 'user-1',
    userName: 'Alex',
    action: 'member_joined',
    details,
    entityType: 'member',
    entityId: 'member-1',
    createdAt: Date.now(),
  }
}

const fetchMock = jest.fn()
const originalFetch = globalThis.fetch

beforeAll(() => {
  ;(
    global as {
      IS_REACT_ACT_ENVIRONMENT?: boolean
      EventSource?: unknown
    }
  ).IS_REACT_ACT_ENVIRONMENT = true
  ;(global as { EventSource?: unknown }).EventSource =
    FakeEventSource
})

afterAll(() => {
  delete (
    global as {
      IS_REACT_ACT_ENVIRONMENT?: boolean
      EventSource?: unknown
    }
  ).IS_REACT_ACT_ENVIRONMENT
  delete (global as { EventSource?: unknown })
    .EventSource
  ;(globalThis as { fetch?: unknown }).fetch =
    originalFetch
})

beforeEach(() => {
  FakeEventSource.instances = []
  fetchMock.mockReset()
  ;(globalThis as { fetch?: unknown }).fetch =
    fetchMock
})

describe('WorkspaceActivityFeed', () => {
  it('renders the activity loaded from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: [
          activity('a1', 'Alex joined the workspace'),
        ],
      }),
    })

    const { container } = await render(
      <WorkspaceActivityFeed workspaceId="ws-1" />
    )
    await flush()

    expect(container.textContent).toContain(
      'Live activity'
    )
    expect(container.textContent).toContain(
      'Alex joined the workspace'
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workspaces/ws-1/activity?limit=10'
    )
  })

  it('prepends events from the live stream', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: [
          activity('a1', 'Alex joined the workspace'),
        ],
      }),
    })

    const { container } = await render(
      <WorkspaceActivityFeed workspaceId="ws-2" />
    )
    await flush()

    const source = FakeEventSource.instances[0]
    expect(source.url).toBe(
      '/api/workspaces/ws-2/events'
    )

    act(() => {
      source.emit(
        activity('a2', 'Sam was invited as admin')
      )
    })
    await flush()

    expect(container.textContent).toContain(
      'Sam was invited as admin'
    )
    // Newest first: the live event leads the
    // loaded one.
    expect(
      container.innerHTML.indexOf(
        'Sam was invited as admin'
      )
    ).toBeLessThan(
      container.innerHTML.indexOf(
        'Alex joined the workspace'
      )
    )
  })

  it('does not duplicate an event the feed already has', async () => {
    const event = activity(
      'a1',
      'Alex joined the workspace'
    )
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: [event],
      }),
    })

    const { container } = await render(
      <WorkspaceActivityFeed workspaceId="ws-3" />
    )
    await flush()

    const source = FakeEventSource.instances[0]
    act(() => {
      // The same event, e.g. delivered again
      // after an SWR revalidation.
      source.emit(event)
    })
    await flush()

    expect(
      container.innerHTML.split(
        'Alex joined the workspace'
      ).length
    ).toBe(2) // one occurrence
  })

  it('renders nothing without activity', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ activity: [] }),
    })

    const { container } = await render(
      <WorkspaceActivityFeed workspaceId="ws-4" />
    )
    await flush()

    expect(container.textContent).toBe('')
  })

  it('renders nothing when the feed cannot be loaded', async () => {
    fetchMock.mockRejectedValue(
      new Error('offline')
    )

    const { container } = await render(
      <WorkspaceActivityFeed workspaceId="ws-5" />
    )
    await flush()

    expect(container.textContent).toBe('')
  })

  it('closes the stream on unmount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: [
          activity('a1', 'Alex joined the workspace'),
        ],
      }),
    })

    const { unmount } = await render(
      <WorkspaceActivityFeed workspaceId="ws-6" />
    )
    await flush()

    const source = FakeEventSource.instances[0]
    expect(source.closed).toBe(false)

    await unmount()

    expect(source.closed).toBe(true)
  })
})
