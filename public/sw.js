/**
 * TaskFlow Service Worker
 *
 * Provides offline caching, background sync, and push notifications.
 * Uses a cache-first strategy for static assets and a network-first
 * strategy for API routes, falling back to cached responses when offline.
 */

const CACHE_NAME = 'taskflow-cache-v1'
const API_CACHE = 'taskflow-api-v1'
const STATIC_CACHE = 'taskflow-static-v1'

const STATIC_ASSETS = [
  '/',
  '/today',
  '/analytics',
  '/settings',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico',
]

const API_ROUTES = [
  '/api/tasks',
  '/api/lists',
  '/api/labels',
  '/api/task-logs',
]

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes for API responses

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) => name !== STATIC_CACHE && name !== API_CACHE && name !== CACHE_NAME
            )
            .map((name) => caches.delete(name))
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch handler: stale-while-revalidate for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (they should be handled by the app)
  if (request.method !== 'GET') {
    return
  }

  // Handle API routes with network-first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  // Handle static assets with cache-first
  event.respondWith(handleStaticRequest(request))
})

/** Network-first with cache fallback and staleness check. */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE)

  try {
    const response = await fetch(request)
    // Cache successful API responses
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Network failed — try cache
    const cached = await cache.match(request)
    if (cached) {
      // Check if cached response is still fresh (within CACHE_DURATION)
      const cachedTime = cached.headers.get('x-cached-at')
      if (cachedTime) {
        const age = Date.now() - parseInt(cachedTime, 10)
        if (age < CACHE_DURATION) {
          return cached
        }
      }
      // Stale cache is still better than nothing
      return cached
    }

    // Return a fallback 503 response
    return new Response(
      JSON.stringify({ error: 'Network unavailable', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/** Cache-first with network fallback. */
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)

  if (cached) {
    // Stale-while-revalidate: return cache, update in background
    event.waitUntil(
      fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone())
        }
      }).catch(() => {})
    )
    return cached
  }

  return fetch(request)
}

// Handle messages from the app (skipWaiting, etc.)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Background sync for offline mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-mutations') {
    event.waitUntil(drainOfflineQueue())
  }
})

async function drainOfflineQueue() {
  const client = await self.clients.get(self.clients.matchAll({ type: 'window' })[0])
  if (client) {
    client.postMessage({ type: 'drain-offline-queue' })
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'taskflow-notification',
    data: data.url ? { url: data.url } : {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/today'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
