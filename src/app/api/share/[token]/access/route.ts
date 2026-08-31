import { NextResponse } from 'next/server'
import { recordShareAccess } from '@/lib/share'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    recordShareAccess(token)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Record share access error:', error)
    return NextResponse.json(
      { error: 'Failed to record access' },
      { status: 500 }
    )
  }
}