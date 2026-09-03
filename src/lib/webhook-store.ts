import 'server-only'

import { createHmac } from 'crypto'
import { eq } from 'drizzle-orm'
import { webhooks } from '@/lib/db/schema'
import { getStoreDb } from '@/lib/db/instance'
import {
  generateWebhookId,
  generateWebhookSecret,
  type Webhook,
  type WebhookEvent,
  type WebhookPayload,
} from '@/lib/webhooks'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000] // 1s, 5s, 30s

function mapRow(row: typeof webhooks.$inferSelect): Webhook {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: JSON.parse(row.events) as WebhookEvent[],
    secret: row.secret,
    active: row.active,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastTriggered: row.lastTriggered ?? undefined,
    lastError: row.lastError ?? undefined,
  }
}

function toRow(webhook: Webhook): typeof webhooks.$inferInsert {
  return {
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    events: JSON.stringify(webhook.events),
    secret: webhook.secret,
    active: webhook.active,
    retryCount: webhook.retryCount,
    maxRetries: webhook.maxRetries,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
    lastTriggered: webhook.lastTriggered ?? null,
    lastError: webhook.lastError ?? null,
  }
}

export function createWebhook(
  name: string,
  url: string,
  events: WebhookEvent[],
  secret?: string
): Webhook {
  const db = getStoreDb()
  const now = Date.now()

  const webhook: Webhook = {
    id: generateWebhookId(),
    name,
    url,
    events,
    secret: secret || generateWebhookSecret(),
    active: true,
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(webhooks).values(toRow(webhook)).run()

  return webhook
}

export function getWebhooks(): Webhook[] {
  const db = getStoreDb()
  return db.select().from(webhooks).all().map(mapRow)
}

export function getWebhook(id: string): Webhook | null {
  const db = getStoreDb()
  const row = db.select().from(webhooks).where(eq(webhooks.id, id)).get()
  return row ? mapRow(row) : null
}

export function updateWebhook(id: string, updates: Partial<Webhook>): Webhook | null {
  const db = getStoreDb()
  const existing = getWebhook(id)
  if (!existing) return null

  const webhook: Webhook = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  }

  db.update(webhooks).set(toRow(webhook)).where(eq(webhooks.id, id)).run()

  return webhook
}

export function deleteWebhook(id: string): boolean {
  const db = getStoreDb()
  const result = db.delete(webhooks).where(eq(webhooks.id, id)).run()
  return result.changes > 0
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload<unknown>,
  attempt = 0
): Promise<boolean> {
  const payloadString = JSON.stringify(payload)
  const signature = signPayload(payloadString, webhook.secret)

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Delivery': `${webhook.id}-${attempt}`,
        'User-Agent': 'TaskFlow-Webhooks/1.0',
      },
      body: payloadString,
    })

    if (response.ok) {
      // Success - update webhook
      updateWebhook(webhook.id, {
        lastTriggered: Date.now(),
        lastError: undefined,
        retryCount: 0,
      })
      return true
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update webhook with error
    updateWebhook(webhook.id, {
      lastError: errorMessage,
      retryCount: attempt + 1,
    })

    // Retry with exponential backoff
    if (attempt < webhook.maxRetries) {
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
      await new Promise(resolve => setTimeout(resolve, delay))
      return deliverWebhook(webhook, payload, attempt + 1)
    }

    return false
  }
}

export async function triggerWebhooks(
  event: WebhookEvent,
  data: unknown
): Promise<void> {
  const db = getStoreDb()
  const activeWebhooks = db
    .select()
    .from(webhooks)
    .where(eq(webhooks.active, true))
    .all()
    .map(mapRow)
    .filter(w => w.events.includes(event))

  if (activeWebhooks.length === 0) return

  const payload: WebhookPayload<unknown> = {
    event,
    timestamp: new Date().toISOString(),
    data,
    webhookId: '', // Will be set per webhook
  }

  // Fire and forget - don't await all
  const promises = activeWebhooks.map(webhook => {
    const webhookPayload = { ...payload, webhookId: webhook.id }
    return deliverWebhook(webhook, webhookPayload)
  })

  // Wait for all deliveries (but don't block the main thread too long)
  Promise.allSettled(promises).catch(console.error)
}
