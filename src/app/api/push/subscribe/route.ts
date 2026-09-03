import { NextRequest, NextResponse } from 'next/server'
import { saveSubscription } from '@/lib/push-store'

export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json() as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
      userId?: string
    }

    if (
      !subscription
      || !subscription.endpoint
      || !subscription.keys?.p256dh
      || !subscription.keys?.auth
    ) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const stored = saveSubscription({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userId: subscription.userId,
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: stored.id,
        endpoint: stored.endpoint,
        userId: stored.userId,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      },
    })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }
}
