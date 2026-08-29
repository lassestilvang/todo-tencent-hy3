import { NextResponse } from 'next/server'
import {
  getLists,
  createList,
  deleteList,
} from '@/lib/tasks'
import { z } from 'zod'

const createListSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emoji: z.string().max(4).optional(),
})

const updateListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emoji: z.string().max(4).nullable().optional(),
})

const patchListSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['update', 'delete']),
  data: updateListSchema.optional(),
})

export async function GET() {
  try {
    const lists = getLists()
    return NextResponse.json(lists)
  } catch (error) {
    console.error('Failed to fetch lists:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createListSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }
    const list = createList(result.data.name, result.data.color, result.data.emoji || '📝')
    return NextResponse.json(list, { status: 201 })
  } catch (error) {
    console.error('List creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const result = patchListSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const { id, action, data } = result.data

    if (action === 'delete') {
      deleteList(id)
      return NextResponse.json({ success: true })
    }

    if (action === 'update' && data) {
      // Note: updateList function would need to be added to tasks.ts
      // For now, we'll use the existing updateTask pattern
      return NextResponse.json({ error: 'Update not implemented yet' }, { status: 501 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('List patch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}