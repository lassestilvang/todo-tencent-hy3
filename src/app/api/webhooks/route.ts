import { NextRequest, NextResponse } from 'next/server'
import { createWebhook, getWebhooks, WebhookEvent, generateWebhookSecret } from '@/lib/webhooks'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, url, events, secret } = body

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, url, events' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      )
    }

    // Validate events
    const validEvents: WebhookEvent[] = [
      'task.created', 'task.updated', 'task.completed', 'task.deleted',
      'list.created', 'list.updated', 'list.deleted'
    ]

    for (const event of events) {
      if (!validEvents.includes(event)) {
        return NextResponse.json(
          { error: `Invalid event: ${event}` },
          { status: 400 }
        )
      }
    }

    const webhook = createWebhook(name, url, events, secret)

    return NextResponse.json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Only returned on creation
        active: webhook.active,
        createdAt: webhook.createdAt,
      },
    })
  } catch (error) {
    console.error('Create webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const webhooks = getWebhooks()

    return NextResponse.json({
      webhooks: webhooks.map(w => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: w.events,
        active: w.active,
        retryCount: w.retryCount,
        maxRetries: w.maxRetries,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        lastTriggered: w.lastTriggered,
        lastError: w.lastError,
        // Don't expose secret in list view
      })),
    })
  } catch (error) {
    console.error('Get webhooks error:', error)
    return NextResponse.json(
      { error: 'Failed to get webhooks' },
      { status: 500 }
    )
  }
}