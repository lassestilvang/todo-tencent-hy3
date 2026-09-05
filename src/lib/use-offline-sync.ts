/**
 * Client-side offline sync hook.
 *
 * Integrates with the IndexedDB offline store and the mutation queue:
 * 1. On mount, syncs any queued mutations from localStorage
 * 2. Listens for 'online' events to trigger sync
 * 3. Caches task/list data in IndexedDB for offline reads
 * 4. Provides utilities for reading cached data when offline
 */

import { useEffect, useState } from 'react'
import { putOffline, getOffline, isOfflineDbAvailable } from '@/lib/offline-db'
import type { Task, List } from '@/types'

const CACHE_KEYS = {
  TASKS: 'tasks:all',
  LISTS: 'lists:all',
  LABELS: 'labels:all',
}

/**
 * Hook that manages offline data caching and sync.
 * Call once from a top-level component (e.g. PWAManifest or RootLayout).
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = async () => {
      setIsOnline(true)
      setSyncStatus('syncing')

      try {
        // Drain the mutation queue
        const { drainQueue } = await import('@/lib/offline-queue')
        await drainQueue()

        // Sync offline DB
        if (isOfflineDbAvailable()) {
          const { syncOfflineStore } = await import('@/lib/offline-db')
          await syncOfflineStore()
        }

        setSyncStatus('synced')
        setTimeout(() => setSyncStatus('idle'), 3000)
      } catch (error) {
        setSyncStatus('failed')
        setTimeout(() => setSyncStatus('idle'), 3000)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('idle')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // On mount, if we're already online, try to drain any remaining queue
    if (navigator.onLine) {
      handleOnline()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, syncStatus }
}

/**
 * Fetch tasks, falling back to offline cache when the network fails.
 */
export async function fetchTasksWithOffline(): Promise<Task[]> {
  try {
    const response = await fetch('/api/tasks?view=all')
    if (!response.ok) throw new Error('Network response not ok')

    const tasks: Task[] = await response.json()

    // Cache in IndexedDB for offline use
    if (isOfflineDbAvailable()) {
      try {
        await putOffline(CACHE_KEYS.TASKS, tasks)
      } catch (e) {
        // IndexedDB write failed — not critical
      }
    }

    return tasks
  } catch (error) {
    // Network failed — try offline cache
    if (isOfflineDbAvailable()) {
      try {
        const cached = await getOffline<Task[]>(CACHE_KEYS.TASKS)
        if (cached) return cached
      } catch (e) {
        console.warn('Offline cache read failed:', e)
      }
    }

    // Last resort: check localStorage
    const local = localStorage.getItem('taskflow-tasks-cache')
    if (local) {
      try {
        return JSON.parse(local) as Task[]
      } catch {
        return []
      }
    }

    throw error
  }
}

/**
 * Fetch lists, falling back to offline cache.
 */
export async function fetchListsWithOffline(): Promise<List[]> {
  try {
    const response = await fetch('/api/lists')
    if (!response.ok) throw new Error('Network response not ok')

    const lists: List[] = await response.json()

    if (isOfflineDbAvailable()) {
      try {
        await putOffline(CACHE_KEYS.LISTS, lists)
      } catch {
        // Not critical
      }
    }

    return lists
  } catch {
    if (isOfflineDbAvailable()) {
      try {
        const cached = await getOffline<List[]>(CACHE_KEYS.LISTS)
        if (cached) return cached
      } catch {
        // fall through
      }
    }
    return []
  }
}

/**
 * Read from the offline cache (IndexedDB or localStorage fallback).
 */
export async function readOffline<T>(key: string): Promise<T | null> {
  if (isOfflineDbAvailable()) {
    try {
      return await getOffline<T>(key)
    } catch {
      // fall through to localStorage
    }
  }

  const local = localStorage.getItem(`taskflow-cache:${key}`)
  if (local) {
    try {
      return JSON.parse(local) as T
    } catch {
      return null
    }
  }

  return null
}

/**
 * Write to the offline cache (IndexedDB or localStorage fallback).
 */
export async function writeOffline<T>(key: string, value: T): Promise<void> {
  if (isOfflineDbAvailable()) {
    try {
      await putOffline(`cache:${key}`, value)
      return
    } catch {
      // fall through to localStorage
    }
  }

  try {
    localStorage.setItem(`taskflow-cache:${key}`, JSON.stringify(value))
  } catch {
    // Storage full
  }
}
