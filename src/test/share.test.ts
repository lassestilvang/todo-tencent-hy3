import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/db/instance'

// Set up test database before importing the share store
setDbInstanceForTesting(testDb)

import {
  createShareLink,
  getShareLink,
  getShareLinkById,
  getListShareLinks,
  validateShareAccess,
  recordShareAccess,
  revokeShareLink,
  revokeAllListShares,
} from '@/lib/share-store'

describe('Share Links', () => {
  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
  })

  describe('createShareLink', () => {
    it('should create a share link with generated token', () => {
      const link = createShareLink('inbox', 'view')

      expect(link).toBeDefined()
      expect(link.id).toMatch(/^share_/)
      expect(link.token).toBeDefined()
      expect(link.token.length).toBeGreaterThan(0)
      expect(link.listId).toBe('inbox')
      expect(link.permission).toBe('view')
      expect(link.createdBy).toBe('current-user')
      expect(link.accessCount).toBe(0)
      expect(link.createdAt).toBeDefined()
      expect(link.expiresAt).toBeUndefined()
      expect(link.passwordHash).toBeUndefined()
    })

    it('should create link with expiration', () => {
      const before = Date.now()
      const link = createShareLink('inbox', 'edit', { expiresInDays: 7 })

      expect(link.expiresAt).toBeDefined()
      expect(link.expiresAt!).toBeGreaterThan(before)
      expect(link.expiresAt!).toBeLessThan(Date.now() + 8 * 24 * 60 * 60 * 1000)
    })

    it('should create link with hashed password', () => {
      const link = createShareLink('inbox', 'view', { password: 'secret123' })

      expect(link.passwordHash).toBeDefined()
      expect(link.passwordHash).not.toBe('secret123')
      expect(link.passwordHash!.length).toBe(64) // SHA-256 hex
    })

    it('should persist the link', () => {
      const link = createShareLink('inbox', 'comment')
      const stored = getShareLink(link.token)

      expect(stored).toBeDefined()
      expect(stored!.id).toBe(link.id)
    })
  })

  describe('getShareLink', () => {
    it('should return null for unknown token', () => {
      expect(getShareLink('unknown-token')).toBeNull()
    })

    it('should return link by token', () => {
      const link = createShareLink('inbox', 'view')
      const found = getShareLink(link.token)

      expect(found).toBeDefined()
      expect(found!.token).toBe(link.token)
      expect(found!.listId).toBe('inbox')
    })
  })

  describe('getShareLinkById', () => {
    it('should return null for unknown id', () => {
      expect(getShareLinkById('share_unknown')).toBeNull()
    })

    it('should return link by id', () => {
      const link = createShareLink('inbox', 'view')
      const found = getShareLinkById(link.id)

      expect(found).toBeDefined()
      expect(found!.id).toBe(link.id)
    })
  })

  describe('getListShareLinks', () => {
    it('should return empty array when no links exist', () => {
      expect(getListShareLinks('inbox')).toEqual([])
    })

    it('should return only links for the given list', () => {
      createShareLink('inbox', 'view')
      createShareLink('inbox', 'edit')
      createShareLink('other-list', 'view')

      const links = getListShareLinks('inbox')
      expect(links).toHaveLength(2)
      expect(links.every(l => l.listId === 'inbox')).toBe(true)
    })
  })

  describe('validateShareAccess', () => {
    it('should validate a link without password or expiry', () => {
      const link = createShareLink('inbox', 'view')
      const result = validateShareAccess(link.token)

      expect(result.valid).toBe(true)
      expect(result.link!.token).toBe(link.token)
    })

    it('should reject unknown token', () => {
      const result = validateShareAccess('unknown-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid or expired share link')
    })

    it('should reject expired link', () => {
      const link = createShareLink('inbox', 'view', { expiresInDays: -1 })
      const result = validateShareAccess(link.token)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Share link has expired')
    })

    it('should require password when protected', () => {
      const link = createShareLink('inbox', 'view', { password: 'letmein' })
      const result = validateShareAccess(link.token)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Password required')
    })

    it('should reject wrong password', () => {
      const link = createShareLink('inbox', 'view', { password: 'letmein' })
      const result = validateShareAccess(link.token, 'wrong')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid password')
    })

    it('should accept correct password', () => {
      const link = createShareLink('inbox', 'view', { password: 'letmein' })
      const result = validateShareAccess(link.token, 'letmein')

      expect(result.valid).toBe(true)
      expect(result.link!.token).toBe(link.token)
    })
  })

  describe('recordShareAccess', () => {
    it('should increment access count and set last accessed', () => {
      const link = createShareLink('inbox', 'view')
      expect(link.accessCount).toBe(0)

      recordShareAccess(link.token)
      const updated = getShareLink(link.token)

      expect(updated!.accessCount).toBe(1)
      expect(updated!.lastAccessed).toBeDefined()

      recordShareAccess(link.token)
      expect(getShareLink(link.token)!.accessCount).toBe(2)
    })

    it('should be a no-op for unknown token', () => {
      expect(() => recordShareAccess('unknown-token')).not.toThrow()
    })
  })

  describe('revokeShareLink', () => {
    it('should remove the link', () => {
      const link = createShareLink('inbox', 'view')
      expect(getShareLink(link.token)).toBeDefined()

      const result = revokeShareLink(link.token)

      expect(result).toBe(true)
      expect(getShareLink(link.token)).toBeNull()
    })

    it('should return false for unknown token', () => {
      expect(revokeShareLink('unknown-token')).toBe(false)
    })
  })

  describe('revokeAllListShares', () => {
    it('should remove all links for a list', () => {
      const link1 = createShareLink('inbox', 'view')
      const link2 = createShareLink('inbox', 'edit')
      createShareLink('other-list', 'view')

      const removed = revokeAllListShares('inbox')

      expect(removed).toBe(2)
      expect(getShareLink(link1.token)).toBeNull()
      expect(getShareLink(link2.token)).toBeNull()
    })

    it('should return 0 when no links exist', () => {
      expect(revokeAllListShares('inbox')).toBe(0)
    })
  })
})
