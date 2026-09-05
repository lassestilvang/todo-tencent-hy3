import { NextResponse } from 'next/server'
import { getTaskArcheology } from '@/lib/tasks'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getTaskArcheology(id)

    return NextResponse.json({
      task: result.task,
      timeline: result.timeline,
      logCount: result.logCount,
    })
  } catch (error) {
    console.error('Failed to fetch task archeology:', error)
    return NextResponse.json(
      { error: 'Failed to fetch task archeology' },
      { status: 500 }
    )
  }
}
