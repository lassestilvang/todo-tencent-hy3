/**
 * @jest-environment node
 *
 * The proxy builds NextRequest objects, which
 * extend the fetch API's Request — jsdom has
 * no Request, Node does.
 */
"use strict"

import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { resetRateLimit } from '@/lib/rate-limit'

const HOST = 'http://localhost:3000'

function apiRequest(
  path: string,
  options: {
    method?: string
    origin?: string
    referer?: string
  } = {}
): NextRequest {
  const headers: Record<string, string> = {}
  if (options.origin !== undefined) {
    headers.Origin = options.origin
  }
  if (options.referer !== undefined) {
    headers.Referer = options.referer
  }

  return new NextRequest(`${HOST}${path}`, {
    method: options.method ?? 'GET',
    headers,
  })
}

describe('Proxy CSRF protection', () => {
  beforeEach(() => {
    resetRateLimit()
  })

  it('lets safe methods through untouched', () => {
    const response = proxy(apiRequest('/api/tasks'))

    expect(response.status).toBe(200)
  })

  it('allows a same-origin state-changing request', () => {
    const response = proxy(
      apiRequest('/api/tasks', {
        method: 'POST',
        origin: HOST,
      })
    )

    expect(response.status).toBe(200)
  })

  it('rejects a cross-origin state-changing request', () => {
    const response = proxy(
      apiRequest('/api/tasks', {
        method: 'POST',
        origin: 'http://evil.example',
      })
    )

    expect(response.status).toBe(403)
  })

  it('falls back to the referer when Origin is absent', () => {
    const allowed = proxy(
      apiRequest('/api/tasks', {
        method: 'PATCH',
        referer: `${HOST}/task/1`,
      })
    )
    expect(allowed.status).toBe(200)

    const rejected = proxy(
      apiRequest('/api/tasks', {
        method: 'PATCH',
        referer: 'http://evil.example/task/1',
      })
    )
    expect(rejected.status).toBe(403)
  })

  it('allows requests with no browser headers', () => {
    // curl and integrations send neither Origin
    // nor Referer; browsers always send Origin on
    // cross-site state changes, so an absent pair
    // cannot be a forgery.
    const response = proxy(
      apiRequest('/api/tasks', { method: 'POST' })
    )

    expect(response.status).toBe(200)
  })

  it('exempts the webhook trigger endpoint', () => {
    const response = proxy(
      apiRequest('/api/webhooks/trigger', {
        method: 'POST',
        origin: 'http://evil.example',
      })
    )

    expect(response.status).toBe(200)
  })

  it('exempts the push send endpoint', () => {
    const response = proxy(
      apiRequest('/api/push/send', {
        method: 'POST',
        origin: 'http://evil.example',
      })
    )

    expect(response.status).toBe(200)
  })

  it('still answers 429 after the CSRF check passes', () => {
    // Burn the per-IP budget (default 120/min).
    for (let i = 0; i < 120; i++) {
      proxy(apiRequest('/api/tasks', {
        method: 'POST',
        origin: HOST,
      }))
    }

    const response = proxy(
      apiRequest('/api/tasks', {
        method: 'POST',
        origin: HOST,
      })
    )

    expect(response.status).toBe(429)
  })
})

describe('Proxy edge-cache policy', () => {
  beforeEach(() => {
    resetRateLimit()
  })

  it('opts API responses out of shared caches', () => {
    // Task data is private and mutates constantly; it
    // must never sit in an edge/CDN cache.
    const response = proxy(apiRequest('/api/tasks'))

    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('opts rejection responses out of shared caches', () => {
    const response = proxy(
      apiRequest('/api/tasks', {
        method: 'POST',
        origin: 'http://evil.example',
      })
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('opts rate-limited responses out of shared caches', () => {
    for (let i = 0; i < 120; i++) {
      proxy(apiRequest('/api/tasks', {
        method: 'POST',
        origin: HOST,
      }))
    }

    const response = proxy(
      apiRequest('/api/tasks', {
        method: 'POST',
        origin: HOST,
      })
    )

    expect(response.status).toBe(429)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
