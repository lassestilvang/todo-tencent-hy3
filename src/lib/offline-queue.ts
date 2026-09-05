'use client'

/**
 * Offline mutation queue.
 *
 * Mutations that cannot reach the network
 * (app offline, or the fetch fails with a
 * network error) are persisted here and
 * replayed in order once connectivity
 * returns. localStorage is enough for a
 * queue of pending requests — no IndexedDB
 * needed for the offline slice.
 */

export interface QueuedMutation {
  id: string
  method: string
  url: string
  body?: string
  queuedAt: number
}

const QUEUE_KEY = 'taskflow-offline-queue'
const MAX_QUEUED = 100

function generateQueueId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Mutations waiting for the network to return. */
export function loadQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : []
  } catch {
    // Corrupt storage starts over empty.
    return []
  }
}

function saveQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(queue.slice(0, MAX_QUEUED))
    )
  } catch {
    // Storage is full — drop the oldest
    // entries and try once more.
    if (queue.length > 1) {
      saveQueue(queue.slice(1))
    }
  }
}

/** Append a mutation to the queue. */
export function enqueueMutation(
  mutation: Omit<QueuedMutation, 'id' | 'queuedAt'>
): QueuedMutation {
  const entry: QueuedMutation = {
    ...mutation,
    id: generateQueueId(),
    queuedAt: Date.now(),
  }
  saveQueue([...loadQueue(), entry])
  return entry
}

/** Drop every queued mutation. */
export function clearQueue(): void {
  saveQueue([])
}

function isNetworkError(error: unknown): boolean {
  // The fetch spec rejects with a TypeError
  // when the request could not be made at
  // all (as opposed to an HTTP error status).
  return error instanceof TypeError
}

/**
 * Send a request, or queue it when the
 * network is unavailable. Returns the
 * response, or a synthetic 202 (Accepted —
 * queued) when the mutation was persisted.
 */
export async function sendOrQueue(
  method: string,
  url: string,
  body?: unknown
): Promise<Response> {
  const payload =
    body === undefined
      ? undefined
      : JSON.stringify(body)

  const queueIt = () => {
    enqueueMutation({ method, url, body: payload })
    return new Response(null, { status: 202 })
  }

  if (
    typeof navigator !== 'undefined' &&
    !navigator.onLine
  ) {
    return queueIt()
  }

  try {
    return await fetch(url, {
      method,
      headers:
        payload === undefined
          ? undefined
          : { 'Content-Type': 'application/json' },
      body: payload,
    })
  } catch (error) {
    if (isNetworkError(error)) {
      return queueIt()
    }
    throw error
  }
}

/**
 * Replay queued mutations in order. Returns
 * the ones that were delivered (and are now
 * dropped); failures stay queued for the
 * next attempt.
 */
export async function drainQueue(): Promise<
  QueuedMutation[]
> {
  const queue = loadQueue()
  if (queue.length === 0) {
    return []
  }

  const delivered: QueuedMutation[] = []
  const remaining: QueuedMutation[] = []

  for (const mutation of queue) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers:
          mutation.body === undefined
            ? undefined
            : { 'Content-Type': 'application/json' },
        body: mutation.body,
      })
      if (response.ok) {
        delivered.push(mutation)
      } else {
        // Rejected by the server — keep it
        // queued so the caller can see it.
        remaining.push(mutation)
      }
    } catch {
      // Still offline: stop draining; this
      // mutation and the rest remain queued.
      remaining.push(mutation)
      remaining.push(
        ...queue.slice(queue.indexOf(mutation) + 1)
      )
      break
    }
  }

  saveQueue(remaining)
  return delivered
}
