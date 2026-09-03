import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTaskDependencies, addTaskDependency } from '@/lib/tasks'

const addDependencySchema = z.object({
  blockingTaskId: z.string().min(1),
  type: z.enum(['blocks', 'relates', 'duplicates']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const dependencies = getTaskDependencies(id)
    return NextResponse.json(dependencies)
  } catch (error) {
    console.error('Get task dependencies error:', error)
    return NextResponse.json(
      { error: 'Failed to get task dependencies' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const result = addDependencySchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    // [id] is the blocked task; the request body supplies the blocking task.
    addTaskDependency(result.data.blockingTaskId, id, result.data.type)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Add task dependency error:', error)
    return NextResponse.json(
      { error: 'Failed to add task dependency' },
      { status: 500 }
    )
  }
}
