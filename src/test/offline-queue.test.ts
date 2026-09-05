/**
 * @jest-environment node
 *
 * The queue persists to localStorage and reads
 * navigator.onLine; both are shimmed here so
 * the offline paths can be exercised without
 * a browser.
 */
"use strict";

import {
  loadQueue,
  enqueueMutation,
  clearQueue,
  sendOrQueue,
  drainQueue,
} from '@/lib/offline-queue'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) =>
      storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    },
  },
})

let online = true
Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  get: () => online,
})

const fetchMock = jest.fn()
const originalFetch = globalThis.fetch

function setOnline(value: boolean) {
  online = value
}

beforeEach(() => {
  storage.clear()
  online = true
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

function queuedRequest(index: number): {
  url: string
  method?: string
  body?: string
  headers?: unknown
} {
  const call = fetchMock.mock.calls[index] as [
    string,
    {
      method?: string
      body?: string
      headers?: unknown
    }?,
  ]
  return { url: call[0], ...call[1] }
}

describe('queue persistence', () => {
  it('starts empty', () => {
    expect(loadQueue()).toEqual([])
  })

  it('persists an enqueued mutation', () => {
    enqueueMutation({
      method: 'PATCH',
      url: '/api/tasks',
      body: '{"id":"task-1"}',
    })

    const queue = loadQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      method: 'PATCH',
      url: '/api/tasks',
      body: '{"id":"task-1"}',
    })
    expect(queue[0].id).toBeTruthy()
    expect(queue[0].queuedAt).toBeGreaterThan(0)
  })

  it('clears the queue', () => {
    enqueueMutation({ method: 'PATCH', url: '/api/tasks' })

    clearQueue()

    expect(loadQueue()).toEqual([])
  })

  it('recovers from corrupt storage', () => {
    storage.set('taskflow-offline-queue', '{broken')

    expect(loadQueue()).toEqual([])
  })
})

describe('sendOrQueue', () => {
  it('sends the request when online', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const response = await sendOrQueue(
      'PATCH',
      '/api/tasks',
      { id: 'task-1' }
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(queuedRequest(0)).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ id: 'task-1' }),
    })
    expect(loadQueue()).toEqual([])
  })

  it('queues without a request when offline', async () => {
    setOnline(false)

    const response = await sendOrQueue(
      'PATCH',
      '/api/tasks',
      { id: 'task-1' }
    )

    // 202 Accepted — the mutation is queued.
    expect(response.status).toBe(202)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(loadQueue()).toHaveLength(1)
  })

  it('queues when the fetch fails with a network error', async () => {
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed')
    )

    const response = await sendOrQueue(
      'PATCH',
      '/api/tasks',
      { id: 'task-1' }
    )

    expect(response.status).toBe(202)
    expect(loadQueue()).toHaveLength(1)
    expect(loadQueue()[0].method).toBe('PATCH')
  })

  it('rethrows errors that are not network errors', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))

    await expect(
      sendOrQueue('PATCH', '/api/tasks', { id: 'x' })
    ).rejects.toThrow('boom')
    expect(loadQueue()).toEqual([])
  })

  it('sends bodyless requests without a content type', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await sendOrQueue('DELETE', '/api/tasks/task-1')

    expect(queuedRequest(0).method).toBe('DELETE')
    expect(queuedRequest(0).body).toBeUndefined()
    expect(queuedRequest(0).headers).toBeUndefined()
  })
})

describe('drainQueue', () => {
  it('delivers queued mutations in order', async () => {
    enqueueMutation({
      method: 'PATCH',
      url: '/api/tasks',
      body: '{"id":"task-1"}',
    })
    enqueueMutation({
      method: 'DELETE',
      url: '/api/tasks/task-2',
    })
    fetchMock.mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const delivered = await drainQueue()

    expect(delivered.map((entry) => entry.method)).toEqual(
      ['PATCH', 'DELETE']
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(queuedRequest(0).body).toBe(
      '{"id":"task-1"}'
    )
    expect(loadQueue()).toEqual([])
  })

  it('keeps mutations the server rejected', async () => {
    enqueueMutation({
      method: 'PATCH',
      url: '/api/tasks',
      body: '{"id":"task-1"}',
    })
    fetchMock.mockResolvedValue(
      new Response(null, { status: 500 })
    )

    const delivered = await drainQueue()

    expect(delivered).toEqual([])
    expect(loadQueue()).toHaveLength(1)
  })

  it('stops and keeps the rest when the network drops', async () => {
    enqueueMutation({
      method: 'PATCH',
      url: '/api/tasks',
      body: '{"id":"task-1"}',
    })
    enqueueMutation({
      method: 'DELETE',
      url: '/api/tasks/task-2',
    })
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed')
    )

    const delivered = await drainQueue()

    expect(delivered).toEqual([])
    expect(loadQueue()).toHaveLength(2)
  })

  it('does nothing with an empty queue', async () => {
    expect(await drainQueue()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
