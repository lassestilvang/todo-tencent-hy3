import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/db/instance'

// Set up test database before importing the webhook store
setDbInstanceForTesting(testDb)

import {
  createWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  triggerWebhooks,
} from '@/lib/webhook-store'

// Helper to let fire-and-forget deliveries settle
const flushDeliveries = () => new Promise(resolve => setTimeout(resolve, 100))

describe('Webhooks', () => {
  const originalFetch = global.fetch

  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  describe('createWebhook', () => {
    it('should create a webhook with generated id and secret', () => {
      const webhook = createWebhook('CI Hook', 'https://example.com/hook', ['task.created'])

      expect(webhook).toBeDefined()
      expect(webhook.id).toMatch(/^wh_/)
      expect(webhook.name).toBe('CI Hook')
      expect(webhook.url).toBe('https://example.com/hook')
      expect(webhook.events).toEqual(['task.created'])
      expect(webhook.secret).toBeDefined()
      expect(webhook.secret.length).toBe(64)
      expect(webhook.active).toBe(true)
      expect(webhook.retryCount).toBe(0)
      expect(webhook.maxRetries).toBe(3)
      expect(webhook.createdAt).toBeDefined()
      expect(webhook.updatedAt).toBeDefined()
    })

    it('should use provided secret', () => {
      const webhook = createWebhook('Hook', 'https://example.com', ['task.updated'], 'my-secret')

      expect(webhook.secret).toBe('my-secret')
    })

    it('should persist the webhook', () => {
      const webhook = createWebhook('Hook', 'https://example.com', ['task.created'])
      const stored = getWebhook(webhook.id)

      expect(stored).toBeDefined()
      expect(stored!.name).toBe('Hook')
    })
  })

  describe('getWebhooks', () => {
    it('should return empty array when none exist', () => {
      expect(getWebhooks()).toEqual([])
    })

    it('should return all stored webhooks', () => {
      createWebhook('Hook 1', 'https://example.com/1', ['task.created'])
      createWebhook('Hook 2', 'https://example.com/2', ['task.updated'])

      const webhooks = getWebhooks()
      expect(webhooks).toHaveLength(2)
    })
  })

  describe('getWebhook', () => {
    it('should return null when not found', () => {
      expect(getWebhook('wh_unknown')).toBeNull()
    })

    it('should return webhook by id', () => {
      const webhook = createWebhook('Hook', 'https://example.com', ['task.created'])
      const found = getWebhook(webhook.id)

      expect(found).toBeDefined()
      expect(found!.id).toBe(webhook.id)
    })
  })

  describe('updateWebhook', () => {
    it('should update mutable fields', () => {
      const webhook = createWebhook('Hook', 'https://example.com', ['task.created'])

      const updated = updateWebhook(webhook.id, {
        name: 'Renamed',
        url: 'https://example.com/new',
        events: ['task.deleted'],
        active: false,
        maxRetries: 5,
      })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('Renamed')
      expect(updated!.url).toBe('https://example.com/new')
      expect(updated!.events).toEqual(['task.deleted'])
      expect(updated!.active).toBe(false)
      expect(updated!.maxRetries).toBe(5)
    })

    it('should update the timestamp', () => {
      const webhook = createWebhook('Hook', 'https://example.com', ['task.created'])
      const updated = updateWebhook(webhook.id, { name: 'Renamed' })

      expect(updated!.updatedAt).toBeGreaterThanOrEqual(webhook.updatedAt)
    })

    it('should return null when not found', () => {
      expect(updateWebhook('wh_unknown', { name: 'Nope' })).toBeNull()
    })
  })

  describe('deleteWebhook', () => {
    it('should remove the webhook', () => {
      const webhook = createWebhook('Hook', 'https://example.com', ['task.created'])
      expect(getWebhook(webhook.id)).toBeDefined()

      const result = deleteWebhook(webhook.id)

      expect(result).toBe(true)
      expect(getWebhook(webhook.id)).toBeNull()
    })

    it('should return false when not found', () => {
      expect(deleteWebhook('wh_unknown')).toBe(false)
    })
  })

  describe('triggerWebhooks', () => {
    it('should deliver to matching active webhooks', async () => {
      const webhook = createWebhook('Hook', 'https://example.com/hook', ['task.created'])
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      await triggerWebhooks('task.created', { id: 'task-1' })
      await flushDeliveries()

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('https://example.com/hook')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      expect(options.headers['X-Webhook-Event']).toBe('task.created')
      expect(options.headers['X-Webhook-Signature']).toBeDefined()

      const payload = JSON.parse(options.body)
      expect(payload.event).toBe('task.created')
      expect(payload.data).toEqual({ id: 'task-1' })
      expect(payload.webhookId).toBe(webhook.id)

      // Success should record the trigger
      const updated = getWebhook(webhook.id)
      expect(updated!.lastTriggered).toBeDefined()
    })

    it('should not deliver to webhooks without the event', async () => {
      createWebhook('Hook', 'https://example.com/hook', ['task.updated'])
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      await triggerWebhooks('task.created', {})
      await flushDeliveries()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should not deliver to inactive webhooks', async () => {
      const webhook = createWebhook('Hook', 'https://example.com/hook', ['task.created'])
      updateWebhook(webhook.id, { active: false })
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      await triggerWebhooks('task.created', {})
      await flushDeliveries()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should do nothing when no webhooks exist', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      await triggerWebhooks('task.created', {})
      await flushDeliveries()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should record the error and not retry when maxRetries is 0', async () => {
      const webhook = createWebhook('Hook', 'https://example.com/hook', ['task.created'])
      updateWebhook(webhook.id, { maxRetries: 0 })
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await triggerWebhooks('task.created', {})
      await flushDeliveries()

      expect(global.fetch).toHaveBeenCalledTimes(1)

      const updated = getWebhook(webhook.id)
      expect(updated!.lastError).toContain('HTTP 500')
      expect(updated!.retryCount).toBe(1)
    })

    it('should sign the payload with the webhook secret', async () => {
      createWebhook('Hook', 'https://example.com/hook', ['task.created'], 'known-secret')
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      await triggerWebhooks('task.created', { id: 'task-1' })
      await flushDeliveries()

      const options = (global.fetch as jest.Mock).mock.calls[0][1]
      const { createHmac } = await import('crypto')
      const expected = createHmac('sha256', 'known-secret')
        .update(options.body)
        .digest('hex')

      expect(options.headers['X-Webhook-Signature']).toBe(expected)
    })
  })
})
