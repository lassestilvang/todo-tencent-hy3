import { NextRequest, NextResponse } from 'next/server'
import { canCompleteTask } from '@/lib/tasks'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const result = canCompleteTask(id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Check task completion error:', error)
    return NextResponse.json(
      { error: 'Failed to check task completion' },
      { status: 500 }
    )
  }
}
