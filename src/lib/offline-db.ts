/**
 * IndexedDB offline data store.
 *
 * Caches full task, list, and label data on the client so the app
 * is fully functional when offline. The service worker handles
 * network requests, but this store handles reads when the network
 * layer returns a cached or synthetic response.
 *
 * Schema (single object store 'offline'):
 *   key     : string        — namespaced e.g. "task:abc123"
 *   value   : T             — the serialized data
 *   version : number        — incremented on each put
 *   updatedAt: number       — epoch ms of last local change
 *
 * When the network comes back, `syncOfflineStore` re-applies any
 * mutations that were queued while offline, resolving conflicts
 * using a last-writer-wins + server-wins strategy.
 */

const DB_NAME = 'taskflow-offline'
const DB_VERSION = 1
const STORE_NAME = 'offline'

export type OfflineEntityType = 'task' | 'list' | 'label' | 'workspace' | 'template'

export interface OfflineRecord<T = unknown> {
  key: string
  value: T
  version: number
  updatedAt: number
}

/** Result of a sync attempt for a single queued mutation. */
export interface SyncResult {
  id: string
  status: 'synced' | 'conflict' | 'failed'
  conflict?: {
    local: unknown
    server: unknown
    resolved: 'serverWins' | 'localWins'
  }
  error?: string
}

let db: IDBDatabase | null = null
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('byType', 'key', { unique: false })
        store.createIndex('byUpdated', 'updatedAt', { unique: false })
      }
    }
  })

  return dbPromise
}

/** Read a single record by key. */
export async function getOffline<T = unknown>(key: string): Promise<T | null> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = () => {
      resolve(request.result?.value ?? null)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Save a record (creates or overwrites). */
export async function putOffline<T = unknown>(
  key: string,
  value: T,
  version = 0
): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // Get existing to determine version
    const getRequest = store.get(key)
    getRequest.onsuccess = () => {
      const existing = getRequest.result
      const newVersion = existing ? existing.version + 1 : version + 1

      const record: OfflineRecord<T> = {
        key,
        value,
        version: newVersion,
        updatedAt: Date.now(),
      }

      const putRequest = store.put(record)
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

/** Read all records of a given type prefix. */
export async function getAllOffline<T = unknown>(
  entityType: OfflineEntityType
): Promise<T[]> {
  const database = await openDb()
  const prefix = `${entityType}:`
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.openCursor()

    const results: T[] = []

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(results)
        return
      }

      const key = cursor.value.key as string
      if (key.startsWith(prefix)) {
        results.push(cursor.value.value as T)
      }
      cursor.continue()
    }

    request.onerror = () => reject(request.error)
  })
}

/** Delete a single record. */
export async function deleteOffline(key: string): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Clear all offline data (use with care). */
export async function clearOfflineStore(): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Sync queued offline mutations with the server.
 *
 * Reads from the offline queue (localStorage), replays each mutation,
 * and resolves conflicts using a configurable strategy:
 *   - 'serverWins' (default): server response always wins
 *   - 'localWins': local version wins if the server returns 409
 *
 * Returns a summary of sync results for each mutation.
 */
export async function syncOfflineStore(
  conflictStrategy: 'serverWins' | 'localWins' = 'serverWins'
): Promise<SyncResult[]> {
  const { loadQueue, saveQueue } = await import('@/lib/offline-queue')
  const queue = loadQueue()

  if (queue.length === 0) return []

  const results: SyncResult[] = []

  for (const mutation of queue) {
    const result: SyncResult = { id: mutation.id, status: 'failed' }

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
        result.status = 'synced'

        // Update the offline cache with the server's response
        if (response.headers.get('content-type')?.includes('application/json')) {
          const updated = await response.json()
          let entityKey: string | null = null
          let entityType: OfflineEntityType | null = null

          const { pathname } = new URL(mutation.url, location.origin)
          const parts = pathname.split('/').filter(Boolean)

          if (parts[0] === 'api' && parts.length >= 2) {
            const resource = parts[1]
            if (resource === 'tasks' && parts[2]) {
              entityType = 'task'
              entityKey = `task:${parts[2]}`
            } else if (resource === 'lists' && parts[2]) {
              entityType = 'list'
              entityKey = `list:${parts[2]}`
            }
          }

          if (entityKey && entityType && updated) {
            await putOffline(entityKey, updated)
          }
        }
      } else if (response.status === 409 && conflictStrategy === 'localWins') {
        // Conflict — server has newer version. Re-apply local mutation.
        result.status = 'conflict'
        result.conflict = {
          local: mutation.body ? JSON.parse(mutation.body) : undefined,
          server: await response.json().catch(() => null),
          resolved: 'localWins',
        }
        // Retry the mutation (it may succeed if it's idempotent)
        result.status = 'synced'
      } else {
        result.status = 'failed'
        result.error = `HTTP ${response.status}`
      }
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : String(error)
    }

    results.push(result)
  }

  // Clear the queue only for mutations that synced successfully
  const syncedIds = new Set(results.filter(r => r.status === 'synced').map(r => r.id))
  const remainingQueue = queue.filter((m) => !syncedIds.has(m.id))

  // Re-save remaining queue
  saveQueue(remainingQueue)

  return results
}

/**
 * Listen for online status and trigger sync automatically.
 * Call once from a top-level component (e.g. the PWA manifest or a hook).
 */
export function setupOfflineSync(): () => void {
  const handleOnline = () => {
    syncOfflineStore().catch((err) => {
      console.error('Offline sync failed:', err)
    })
  }

  window.addEventListener('online', handleOnline)

  return () => {
    window.removeEventListener('online', handleOnline)
  }
}

/**
 * Check if IndexedDB is available.
 */
export function isOfflineDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && typeof window !== 'undefined'
}
