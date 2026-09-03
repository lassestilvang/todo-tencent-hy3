/**
 * Fixed-window rate limiter
 *
 * Used by the proxy (src/proxy.ts) to throttle API requests per client.
 * The store is in-memory, so it is correct for a single-process deployment
 * (this app runs one Node process against better-sqlite3). A multi-instance
 * deployment should swap the Map for a shared store such as Redis.
 *
 * This module is deliberately runtime-agnostic (no `server-only`) so it can
 * be bundled into the proxy, which may run in a different runtime than the
 * route handlers.
 */

export interface RateLimitConfig {
  /** Length of the fixed window in milliseconds */
  windowMs: number
  /** Maximum requests allowed within the window */
  max: number
}

export interface RateLimitResult {
  /** Whether the request may proceed */
  allowed: boolean
  /** Requests still available in the current window */
  remaining: number
  /** Epoch milliseconds when the current window resets */
  resetAt: number
  /** Seconds until the window resets (for the Retry-After header) */
  retryAfter: number
}

interface WindowEntry {
  count: number
  resetAt: number
}

const windows = new Map<string, WindowEntry>()

// Bound memory: once the map grows past this many keys, drop expired entries.
const MAX_TRACKED_KEYS = 10_000

function prune(now: number) {
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) {
      windows.delete(key)
    }
  }
}

/**
 * Record a request for `key` and report whether it is within `config.max`
 * for the current window. Windows are fixed (not sliding): the counter
 * resets every `windowMs`.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()

  if (windows.size > MAX_TRACKED_KEYS) {
    prune(now)
  }

  const entry = windows.get(key)
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + config.windowMs
    windows.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt,
      retryAfter: Math.ceil(config.windowMs / 1000),
    }
  }

  entry.count += 1
  const allowed = entry.count <= config.max
  const remaining = Math.max(0, config.max - entry.count)
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))

  return { allowed, remaining, resetAt: entry.resetAt, retryAfter }
}

/** Clear rate-limit state. Intended for tests; accepts an optional key. */
export function resetRateLimit(key?: string): void {
  if (key === undefined) {
    windows.clear()
  } else {
    windows.delete(key)
  }
}

/**
 * Best-effort client IP for rate-limit keys. Prefers the forwarded headers
 * set by reverse proxies, then Next's parsed IP, and finally falls back to
 * a constant so that direct/local requests still share a single bucket.
 */
export function getClientIp(request: {
  headers: { get(name: string): string | null }
  ip?: string | null
}): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for may be a comma-separated list; the first entry is the client.
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return request.ip ?? 'unknown'
}
