import { NextRequest, NextResponse } from 'next/server'
import { removeSubscription } from '@/lib/push-store'

interface UnsubscribeRequest {
  endpoint: string
}

export async function POST(request: NextRequest) {
  try {
    const { endpoint } = await request.json() as UnsubscribeRequest

    if (!endpoint) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    const removed = removeSubscription(endpoint)

    return NextResponse.json({ success: true, removed })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
}
