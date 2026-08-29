import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'

// In-memory webhook store (in production, use a database)
const webhooks: Map<string, WebhookConfig> = new Map()

interface WebhookConfig {
  id: string
  url: string
  secret: string
  events: string[]
  active: boolean
  createdAt: string
  lastTriggered?: string
  failureCount: number
}

const createWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16).max(128).optional(),
  events: z.array(z.enum([
    'task.created',
    'task.updated',
    'task.completed',
    'task.deleted',
    'list.created',
    'list.updated',
    'list.deleted',
    'label.created',
    'label.updated',
    'label.deleted',
  ])).min(1),
})

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(16).max(128).optional(),
  events: z.array(z.enum([
    'task.created',
    'task.updated',
    'task.completed',
    'task.deleted',
    'list.created',
    'list.updated',
    'list.deleted',
    'label.created',
    'label.updated',
    'label.deleted',
  ])).optional(),
  active: z.boolean().optional(),
})

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

async function deliverWebhook(webhook: WebhookConfig, event: string, payload: any): Promise<boolean> {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(body)
    .digest('hex')

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'User-Agent': 'TaskFlow-Webhook/1.0',
      },
      body,
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`Webhook ${webhook.id} failed: ${response.status} ${response.statusText}`)
      return false
    }

    return true
  } catch (error) {
    console.error(`Webhook ${webhook.id} error:`, error)
    return false
  }
}

// POST /api/webhooks - Create a new webhook
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createWebhookSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const secret = result.data.secret || generateSecret()

    const webhook: WebhookConfig = {
      id,
      url: result.data.url,
      secret,
      events: result.data.events,
      active: true,
      createdAt: new Date().toISOString(),
      failureCount: 0,
    }

    webhooks.set(id, webhook)

    return NextResponse.json(
      { ...webhook, secret: undefined }, // Don't return secret in response
      { status: 201 }
    )
  } catch (error) {
    console.error('Webhook creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/webhooks - List all webhooks
export async function GET() {
  try {
    const webhookList = Array.from(webhooks.values()).map(w => ({
      ...w,
      secret: undefined, // Don't expose secrets
    }))
    return NextResponse.json(webhookList)
  } catch (error) {
    console.error('Failed to fetch webhooks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    )
  }
}

// PATCH /api/webhooks - Update a webhook
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id || !webhooks.has(id)) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    const result = updateWebhookSchema.safeParse(updates)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const webhook = webhooks.get(id)!
    const updated = { ...webhook, ...result.data }
    webhooks.set(id, updated)

    return NextResponse.json({ ...updated, secret: undefined })
  } catch (error) {
    console.error('Webhook update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/webhooks - Delete a webhook
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || !webhooks.has(id)) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    webhooks.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to trigger webhooks (for internal use)
export async function triggerWebhook(event: string, payload: any) {
  const relevantWebhooks = Array.from(webhooks.values()).filter(
    w => w.active && w.events.includes(event)
  )

  for (const webhook of relevantWebhooks) {
    const success = await deliverWebhook(webhook, event, payload)
    if (success) {
      webhook.lastTriggered = new Date().toISOString()
      webhook.failureCount = 0
    } else {
      webhook.failureCount++
      // Disable webhook after 5 consecutive failures
      if (webhook.failureCount >= 5) {
        webhook.active = false
        console.warn(`Webhook ${webhook.id} disabled after 5 consecutive failures`)
      }
    }
    webhooks.set(webhook.id, webhook)
  }
}