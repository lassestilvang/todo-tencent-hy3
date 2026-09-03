import { NextRequest, NextResponse } from 'next/server'
import { removeTaskDependency } from '@/lib/tasks'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockingId: string }> }
) {
  try {
    const { id, blockingId } = await params
    if (!id || !blockingId) {
      return NextResponse.json(
        { error: 'Task ID and blocking task ID are required' },
        { status: 400 }
      )
    }

    // [id] is the blocked task; [blockingId] is the task that blocks it.
    removeTaskDependency(blockingId, id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove task dependency error:', error)
    return NextResponse.json(
      { error: 'Failed to remove task dependency' },
      { status: 500 }
    )
  }
}
