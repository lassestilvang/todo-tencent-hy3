import { NextRequest, NextResponse } from 'next/server'
import { acceptInvitation } from '@/lib/workspace-store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, userId, userName } = body

    if (!token || !userId || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: token, userId, userName' },
        { status: 400 }
      )
    }

    const result = acceptInvitation(token, userId, userName)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to accept invitation' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      workspace: result.workspace,
    })
  } catch (error) {
    console.error('Accept invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
