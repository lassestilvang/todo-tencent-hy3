import { NextResponse } from 'next/server'
import {
  getTasks,
  createTask,
  toggleTaskComplete,
  deleteTask,
  updateTask,
} from '@/lib/tasks'
import { triggerWebhooks } from '@/lib/webhook-store'
import {
  parseJsonBody,
  RequestValidationError,
  validationErrorResponse,
} from '@/lib/validation'
import { z } from 'zod'
import type { TaskMood } from '@/types'

const MOOD_VALUES: [TaskMood, ...TaskMood[]] = ['fun', 'grind', 'urgent', 'thinking', 'learn', 'calm']

const createTaskSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  date: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  list_id: z.string().optional(),
  estimate: z.coerce.number().int().positive().optional(),
  source: z.string().max(100).optional(),
  mood: z.enum(MOOD_VALUES).optional(),
})

const updateTaskSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  date: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  list_id: z.string().nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  estimate: z.coerce.number().int().positive().nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  mood: z.enum(MOOD_VALUES).nullable().optional(),
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
    const body = await parseJsonBody(
      request,
      createTaskSchema
    )
    const task = createTask(body)
    // Trigger webhook for task creation
    triggerWebhooks('task.created', task)
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error)
    }
    console.error('Task creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, action, data } = await parseJsonBody(
      request,
      patchTaskSchema
    )

    if (action === 'toggle') {
      // Get task before toggling to know the old state
      const { getTask } = await import('@/lib/tasks')
      const oldTask = await getTask(id)
      const wasCompleted = oldTask?.completed ?? false

      toggleTaskComplete(id)

      // Trigger webhook based on new state
      const newTask = await getTask(id)
      if (newTask) {
        if (!wasCompleted && newTask.completed) {
          triggerWebhooks('task.completed', newTask)
        } else if (wasCompleted && !newTask.completed) {
          triggerWebhooks('task.updated', newTask)
        }
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      // Get task before deleting for webhook
      const { getTask } = await import('@/lib/tasks')
      const task = await getTask(id)
      deleteTask(id)
      if (task) {
        triggerWebhooks('task.deleted', task)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'update' && data) {
      updateTask(id, data)
      // Get updated task for webhook
      const { getTask } = await import('@/lib/tasks')
      const updatedTask = await getTask(id)
      if (updatedTask) {
        triggerWebhooks('task.updated', updatedTask)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error)
    }
    console.error('Task patch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
