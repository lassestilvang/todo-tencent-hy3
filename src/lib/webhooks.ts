import { randomBytes, createHmac } from 'crypto'

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

export interface WebhookPayload<T = Record<string, unknown>> {
  event: WebhookEvent
  timestamp: string
  data: T
  webhookId: string
}

const WEBHOOK_PREFIX = 'wh_'

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex')
}

export function generateWebhookId(): string {
  return `${WEBHOOK_PREFIX}${randomBytes(12).toString('base64url')}`
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  // crypto.timingSafeEqual is Node.js API, implement manually for browser
  try {
    if (expectedSignature.length !== signature.length) return false

    let result = 0
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return result === 0
  } catch {
    // If lengths don't match, it's definitely not equal
    return false
  }
}

// Client-side trigger function (for use in client components)
export async function triggerWebhooksClient(
  event: WebhookEvent,
  data: Record<string, unknown>
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