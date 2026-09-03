import { NextRequest, NextResponse } from 'next/server'
import { getInvitation } from '@/lib/workspace-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token parameter' },
        { status: 400 }
      )
    }

    const invitation = getInvitation(token)

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    return NextResponse.json({ invitation })
  } catch (error) {
    console.error('Get invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to get invitation' },
      { status: 500 }
    )
  }
}
