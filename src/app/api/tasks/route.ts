import { NextResponse } from 'next/server'
import {
  getTasks,
  createTask,
  toggleTaskComplete,
  deleteTask,
  updateTask,
} from '@/lib/tasks'
import { z } from 'zod'

const createTaskSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  date: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  list_id: z.string().optional(),
  estimate: z.coerce.number().int().positive().optional(),
})

const updateTaskSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  date: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  list_id: z.string().nullable().optional(),
  estimate: z.coerce.number().int().positive().nullable().optional(),
  completed: z.boolean().optional(),
})

const patchTaskSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['toggle', 'delete', 'update']),
  data: updateTaskSchema.optional(),
})

const validViews = z.enum(['today', 'next7', 'upcoming', 'all'])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const viewResult = validViews.safeParse(searchParams.get('view'))
    const listId = searchParams.get('listId')
    const completed = searchParams.get('completed')

    const tasks = getTasks({
      view: viewResult.success ? viewResult.data : undefined,
      listId: listId || undefined,
      completed:
        completed === 'true' ? true : completed === 'false' ? false : undefined,
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createTaskSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }
    const task = createTask(result.data)
    return NextResponse.json(task)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const result = patchTaskSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    const { id, action, data } = result.data

    if (action === 'toggle') {
      toggleTaskComplete(id)
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      deleteTask(id)
      return NextResponse.json({ success: true })
    }

    if (action === 'update' && data) {
      updateTask(id, data)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
