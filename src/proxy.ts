/**
 * API rate limiting and CSRF protection
 * (Next.js 16 proxy; the successor to `middleware`)
 *
 * Runs before every `/api/*` route handler and enforces fixed-window
 * limits. Sensitive endpoints get stricter per-path limits; everything
 * else shares a generous default. State is in-memory (see
 * `src/lib/rate-limit.ts`), which is correct for this app's
 * single-process deployment.
 *
 * State-changing requests are also checked for a same-site Origin.
 * Browsers send `Origin` on every cross-origin POST, so a mismatched
 * value means the request did not originate from this deployment —
 * a cross-site forgery. Endpoints built for non-browser callers
 * (webhook senders, push clients) are exempt.
 *
 * Every API response carries `Cache-Control: no-store`: task data
 * is private to one user and mutates constantly, so it must never
 * sit in a shared (edge/CDN) cache. Hashed static assets are
 * immutable and already cached by Next.js itself.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit'

/** Edge-cache policy for every API response (see the module doc). */
const NO_STORE = { 'Cache-Control': 'no-store' }

interface StrictRule {
  match: RegExp
  config: RateLimitConfig
  /** Key by the supplied API key (Bearer token) instead of the IP */
  keyedByApiKey: boolean
}

// Stricter limits for endpoints that are abuse-prone or expensive.
const STRICT_RULES: StrictRule[] = [
  // Push delivery is authenticated by API key; limit per key.
  { match: /^\/api\/push\/send/, config: { windowMs: 60_000, max: 30 }, keyedByApiKey: true },
  // OAuth initiation: prevent token-exchange abuse.
  { match: /^\/api\/auth\/google/, config: { windowMs: 60_000, max: 10 }, keyedByApiKey: false },
  // Share-link creation: prevent link spam.
  { match: /^\/api\/share/, config: { windowMs: 60_000, max: 30 }, keyedByApiKey: false },
  // Manual webhook triggering.
  { match: /^\/api\/webhooks\/trigger/, config: { windowMs: 60_000, max: 60 }, keyedByApiKey: false },
]

// Default ceiling for all other API routes, per client IP.
const DEFAULT_LIMIT: RateLimitConfig = { windowMs: 60_000, max: 120 }

// Endpoints that accept requests from non-browser callers,
// which do not carry a same-site Origin header.
const CSRF_EXEMPT_RULES: RegExp[] = [
  /^\/api\/webhooks\/trigger/, // external webhook senders
  /^\/api\/push\/send/, // push delivery, authenticated by API key
]

const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_RULES.some((rule) => rule.test(pathname))
}

/**
 * Whether a state-changing request originates from
 * this deployment.
 *
 * `Origin` is present on every cross-origin browser
 * request, so a mismatch is a forgery. When it is
 * absent the caller is not a browser (curl, an
 * integration); fall back to `Referer`, and only
 * allow the request when neither header contradicts
 * the host.
 */
function requestOriginMatchesHost(
  request: NextRequest
): boolean {
  const host = new URL(request.url).origin

  const origin = request.headers.get('origin')
  if (origin) {
    return origin === host
  }

  const referer = request.headers.get('referer')
  if (referer) {
    return new URL(referer).origin === host
  }

  return true
}

export function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url)

  // CSRF check first: a forged request must not
  // consume rate-limit budget on its way to 403.
  if (
    !CSRF_SAFE_METHODS.has(request.method) &&
    !isCsrfExempt(pathname) &&
    !requestOriginMatchesHost(request)
  ) {
    return NextResponse.json(
      { error: 'Cross-site request rejected' },
      { status: 403, headers: NO_STORE }
    )
  }

  let config = DEFAULT_LIMIT
  let key = getClientIp(request)

  for (const rule of STRICT_RULES) {
    if (rule.match.test(pathname)) {
      config = rule.config
      if (rule.keyedByApiKey) {
        const auth = request.headers.get('authorization') || ''
        const credential = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
        // Fall back to the IP when no credential was supplied.
        if (credential) {
          key = `apikey:${credential}`
        }
      }
      break
    }
  }

  const result = checkRateLimit(key, config)

  const headers = {
    'X-RateLimit-Limit': String(config.max),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
  }

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          ...headers,
          'Retry-After': String(result.retryAfter),
        },
      }
    )
  }

  const response = NextResponse.next()
  response.headers.set('Cache-Control', NO_STORE['Cache-Control'])
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value)
  }
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
