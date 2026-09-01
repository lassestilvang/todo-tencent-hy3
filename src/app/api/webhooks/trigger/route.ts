import { NextRequest, NextResponse } from 'next/server'
import { triggerWebhooks, WebhookEvent } from '@/lib/webhooks'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data } = body

    if (!event) {
      return NextResponse.json(
        { error: 'Missing required field: event' },
        { status: 400 }
      )
    }

    const validEvents: WebhookEvent[] = [
      'task.created', 'task.updated', 'task.completed', 'task.deleted',
      'list.created', 'list.updated', 'list.deleted'
    ]

    if (!validEvents.includes(event)) {
      return NextResponse.json(
        { error: `Invalid event: ${event}` },
        { status: 400 }
      )
    }

    await triggerWebhooks(event, data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Trigger webhooks error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger webhooks' },
      { status: 500 }
    )
  }
}