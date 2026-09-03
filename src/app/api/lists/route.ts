import { NextResponse } from 'next/server'
import {
  getLists,
  createList,
  deleteList,
  updateList,
} from '@/lib/tasks'
import { triggerWebhooks } from '@/lib/webhook-store'
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
    const lists = await getLists()
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
    // Trigger webhook for list creation
    triggerWebhooks('list.created', list)
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
      // Get list before deleting for webhook
      const lists = await getLists()
      const list = lists.find(l => l.id === id)
      deleteList(id)
      if (list) {
        triggerWebhooks('list.deleted', list)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'update' && data) {
      // Filter out null values for emoji
      const updateData: { name?: string; color?: string; emoji?: string } = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.color !== undefined) updateData.color = data.color
      if (data.emoji !== undefined && data.emoji !== null) updateData.emoji = data.emoji

      updateList(id, updateData)
      // Get updated list for webhook
      const lists = await getLists()
      const updatedList = lists.find(l => l.id === id)
      if (updatedList) {
        triggerWebhooks('list.updated', updatedList)
      }
      return NextResponse.json({ success: true })
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