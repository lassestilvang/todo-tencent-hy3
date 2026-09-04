import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/db/instance'

// Set up test database before importing the push store
setDbInstanceForTesting(testDb)

import {
  saveSubscription,
  getSubscription,
  getAllSubscriptions,
  removeSubscription,
} from '@/lib/push-store'

describe('Push Subscriptions', () => {
  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
  })

  const sub = (endpoint: string, userId?: string) => ({
    endpoint,
    p256dh: `p256dh-${endpoint}`,
    auth: `auth-${endpoint}`,
    userId,
  })

  describe('saveSubscription', () => {
    it('should save a new subscription', () => {
      const stored = saveSubscription(sub('https://push.example.com/a', 'user-1'))

      expect(stored).toBeDefined()
      expect(stored.id).toMatch(/^push_/)
      expect(stored.endpoint).toBe('https://push.example.com/a')
      expect(stored.p256dh).toBe('p256dh-https://push.example.com/a')
      expect(stored.auth).toBe('auth-https://push.example.com/a')
      expect(stored.userId).toBe('user-1')
      expect(stored.createdAt).toBeDefined()
      expect(stored.updatedAt).toBeDefined()
    })

    it('should allow a null userId', () => {
      const stored = saveSubscription(sub('https://push.example.com/a'))

      expect(stored.userId).toBeNull()
    })

    it('should upsert on the same endpoint', () => {
      saveSubscription(sub('https://push.example.com/a', 'user-1'))
      const first = getSubscription('https://push.example.com/a')

      const updated = saveSubscription({
        endpoint: 'https://push.example.com/a',
        p256dh: 'rotated-p256dh',
        auth: 'rotated-auth',
        userId: 'user-1',
      })

      expect(updated.id).toBe(first!.id)
      expect(updated.p256dh).toBe('rotated-p256dh')
      expect(updated.auth).toBe('rotated-auth')
      expect(updated.updatedAt).toBeGreaterThanOrEqual(first!.updatedAt)

      // Only one row exists for the endpoint
      expect(getAllSubscriptions()).toHaveLength(1)
    })

    it('should persist the subscription', () => {
      saveSubscription(sub('https://push.example.com/a', 'user-1'))
      const stored = getSubscription('https://push.example.com/a')

      expect(stored).toBeDefined()
      expect(stored!.endpoint).toBe('https://push.example.com/a')
    })
  })

  describe('getSubscription', () => {
    it('should return null for unknown endpoint', () => {
      expect(getSubscription('https://push.example.com/unknown')).toBeNull()
    })
  })

  describe('getAllSubscriptions', () => {
    it('should return empty array when none exist', () => {
      expect(getAllSubscriptions()).toEqual([])
    })

    it('should return all subscriptions', () => {
      saveSubscription(sub('https://push.example.com/a'))
      saveSubscription(sub('https://push.example.com/b'))

      expect(getAllSubscriptions()).toHaveLength(2)
    })

    it('should filter by userId', () => {
      saveSubscription(sub('https://push.example.com/a', 'user-1'))
      saveSubscription(sub('https://push.example.com/b', 'user-2'))
      saveSubscription(sub('https://push.example.com/c', 'user-1'))

      const user1 = getAllSubscriptions('user-1')

      expect(user1).toHaveLength(2)
      expect(user1.every(s => s.userId === 'user-1')).toBe(true)
    })
  })

  describe('removeSubscription', () => {
    it('should remove the subscription', () => {
      saveSubscription(sub('https://push.example.com/a'))
      expect(getSubscription('https://push.example.com/a')).toBeDefined()

      const result = removeSubscription('https://push.example.com/a')

      expect(result).toBe(true)
      expect(getSubscription('https://push.example.com/a')).toBeNull()
    })

    it('should return false for unknown endpoint', () => {
      expect(removeSubscription('https://push.example.com/unknown')).toBe(false)
    })

    it('should only remove the targeted endpoint', () => {
      saveSubscription(sub('https://push.example.com/a'))
      saveSubscription(sub('https://push.example.com/b'))

      removeSubscription('https://push.example.com/a')

      expect(getSubscription('https://push.example.com/a')).toBeNull()
      expect(getSubscription('https://push.example.com/b')).toBeDefined()
    })
  })
})
