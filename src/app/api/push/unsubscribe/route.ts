import { NextRequest, NextResponse } from 'next/server'

interface UnsubscribeRequest {
  endpoint: string
}

export async function POST(request: NextRequest) {
  try {
    const { endpoint } = await request.json() as UnsubscribeRequest

    if (!endpoint) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    console.log('Push unsubscription received:', endpoint)

    // TODO: Remove from database
    // await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
}