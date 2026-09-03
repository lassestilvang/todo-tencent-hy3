import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceActivity } from '@/lib/workspace-store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const activity = getWorkspaceActivity(workspaceId, limit)
    return NextResponse.json({ activity })
  } catch (error) {
    console.error('Get activity error:', error)
    return NextResponse.json(
      { error: 'Failed to get activity' },
      { status: 500 }
    )
  }
}