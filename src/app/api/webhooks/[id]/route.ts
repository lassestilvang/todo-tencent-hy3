import { NextRequest, NextResponse } from 'next/server'
import type { Webhook } from '@/lib/webhooks'
import { getWebhook, updateWebhook, deleteWebhook } from '@/lib/webhook-store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const webhook = getWebhook(id)

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
        active: webhook.active,
        retryCount: webhook.retryCount,
        maxRetries: webhook.maxRetries,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        lastTriggered: webhook.lastTriggered,
        lastError: webhook.lastError,
      },
    })
  } catch (error) {
    console.error('Get webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to get webhook' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, url, events, active, maxRetries } = body

    const updates: Partial<Webhook> = {}
    if (name !== undefined) updates.name = name
    if (url !== undefined) updates.url = url
    if (events !== undefined) updates.events = events
    if (active !== undefined) updates.active = active
    if (maxRetries !== undefined) updates.maxRetries = maxRetries

    const webhook = updateWebhook(id, updates)

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        retryCount: webhook.retryCount,
        maxRetries: webhook.maxRetries,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        lastTriggered: webhook.lastTriggered,
        lastError: webhook.lastError,
      },
    })
  } catch (error) {
    console.error('Update webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const success = deleteWebhook(id)

    if (!success) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    )
  }
}