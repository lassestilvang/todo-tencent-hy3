/**
 * @jest-environment node
 *
 * The presence route builds a NextResponse.
 */
"use strict";

import {
  GET as listPresence,
  POST as heartbeatPresence,
} from '@/app/api/presence/route'
import {
  getActivePresence,
  resetPresenceForTesting,
} from '@/lib/collaboration/presence'

function requestWith(
  url: string,
  init?: RequestInit
): Request {
  return new Request(url, init)
}

beforeEach(() => {
  resetPresenceForTesting()
})

describe('GET /api/presence', () => {
  it('requires a workspaceId', async () => {
    const response = await listPresence(
      requestWith('https://taskflow.test/api/presence')
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Missing workspaceId parameter',
    })
  })

  it('lists who is present', async () => {
    await heartbeatPresence(
      requestWith('https://taskflow.test/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws-1',
          clientId: 'client-a',
          name: 'Alex',
        }),
      })
    )

    const response = await listPresence(
      requestWith(
        'https://taskflow.test/api/presence?workspaceId=ws-1'
      )
    )
    const body = (await response.json()) as {
      presence: { name: string }[]
    }

    expect(response.status).toBe(200)
    expect(body.presence).toHaveLength(1)
    expect(body.presence[0].name).toBe('Alex')
  })

  it('answers with an empty list for an unknown workspace', async () => {
    const response = await listPresence(
      requestWith(
        'https://taskflow.test/api/presence?workspaceId=ws-none'
      )
    )
    const body = (await response.json()) as {
      presence: unknown[]
    }

    expect(response.status).toBe(200)
    expect(body.presence).toEqual([])
  })
})

describe('POST /api/presence', () => {
  it('records a heartbeat', async () => {
    const response = await heartbeatPresence(
      requestWith('https://taskflow.test/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws-1',
          clientId: 'client-a',
          name: 'Alex',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
    })
    expect(
      getActivePresence('ws-1').map((entry) => entry.name)
    ).toEqual(['Alex'])
  })

  it('rejects an incomplete heartbeat', async () => {
    const response = await heartbeatPresence(
      requestWith('https://taskflow.test/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'ws-1' }),
      })
    )
    const body = (await response.json()) as {
      error: string
      details: unknown
    }

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid request data')
    expect(body.details).not.toBeNull()
  })

  it('rejects a body that is not JSON', async () => {
    const response = await heartbeatPresence(
      requestWith('https://taskflow.test/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json',
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Invalid request data',
      details: null,
    })
  })
})
