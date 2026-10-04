import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

// Simple API key authentication
const API_KEY = process.env.PUSH_API_KEY

interface SendNotificationRequest {
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }
  payload: {
    title: string
    body: string
    icon?: string
    badge?: string
    data?: Record<string, unknown>
    actions?: { action: string; title: string; icon?: string }[]
    tag?: string
    requireInteraction?: boolean
    silent?: boolean
  }
}

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@taskflow.app',
    vapidPublicKey,
    vapidPrivateKey
  )
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate with API key
    const authHeader = request.headers.get('authorization') || ''
    const providedKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!API_KEY || providedKey !== API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid or missing API key' },
        { status: 401 }
      )
    }

    const { subscription, payload } = await request.json() as SendNotificationRequest

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify(payload)
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Push send error:', error)

    // Handle expired subscriptions
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 410) {
      // Subscription expired, should be removed from database
      return NextResponse.json({ error: 'Subscription expired' }, { status: 410 })
    }

    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}