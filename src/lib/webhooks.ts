import { createHash, randomBytes, createHmac } from 'crypto'

export type WebhookEvent = 'task.created' | 'task.updated' | 'task.completed' | 'task.deleted' | 'list.created' | 'list.updated' | 'list.deleted'

export interface Webhook {
  id: string
  name: string
  url: string
  events: WebhookEvent[]
  secret: string
  active: boolean
  retryCount: number
  maxRetries: number
  createdAt: number
  updatedAt: number
  lastTriggered?: number
  lastError?: string
}

export interface WebhookPayload<T = any> {
  event: WebhookEvent
  timestamp: string
  data: T
  webhookId: string
}

const WEBHOOKS_KEY = 'webhooks'
const WEBHOOK_PREFIX = 'wh_'
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000] // 1s, 5s, 30s

function getStoredWebhooks(): Webhook[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(WEBHOOKS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveWebhooks(webhooks: Webhook[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(webhooks))
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex')
}

export function generateWebhookId(): string {
  return `${WEBHOOK_PREFIX}${randomBytes(12).toString('base64url')}`
}

export function createWebhook(
  name: string,
  url: string,
  events: WebhookEvent[],
  secret?: string
): Webhook {
  const webhooks = getStoredWebhooks()
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

  webhooks.push(webhook)
  saveWebhooks(webhooks)
  return webhook
}

export function getWebhooks(): Webhook[] {
  return getStoredWebhooks()
}

export function getWebhook(id: string): Webhook | null {
  const webhooks = getStoredWebhooks()
  return webhooks.find(w => w.id === id) || null
}

export function updateWebhook(id: string, updates: Partial<Webhook>): Webhook | null {
  const webhooks = getStoredWebhooks()
  const index = webhooks.findIndex(w => w.id === id)
  if (index === -1) return null

  webhooks[index] = {
    ...webhooks[index],
    ...updates,
    updatedAt: Date.now(),
  }
  saveWebhooks(webhooks)
  return webhooks[index]
}

export function deleteWebhook(id: string): boolean {
  const webhooks = getStoredWebhooks()
  const index = webhooks.findIndex(w => w.id === id)
  if (index === -1) return false

  webhooks.splice(index, 1)
  saveWebhooks(webhooks)
  return true
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // Use timing-safe comparison
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex') === signature
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  attempt: number = 0
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
  data: any
): Promise<void> {
  const webhooks = getStoredWebhooks()
  const activeWebhooks = webhooks.filter(w => w.active && w.events.includes(event))

  if (activeWebhooks.length === 0) return

  const payload: WebhookPayload = {
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

// Client-side trigger function (for use in client components)
export async function triggerWebhooksClient(
  event: WebhookEvent,
  data: any
): Promise<void> {
  // For client-side, we'll call the API route
  try {
    await fetch('/api/webhooks/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    })
  } catch (error) {
    console.error('Failed to trigger webhooks:', error)
  }
}