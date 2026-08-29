import { NextResponse } from 'next/server'
import {
  getLabels,
  createLabel,
  deleteLabel,
} from '@/lib/tasks'
import { z } from 'zod'

const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().max(4).optional(),
})

const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(4).nullable().optional(),
})

const patchLabelSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['update', 'delete']),
  data: updateLabelSchema.optional(),
})

export async function GET() {
  try {
    const labels = getLabels()
    return NextResponse.json(labels)
  } catch (error) {
    console.error('Failed to fetch labels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createLabelSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }
    const label = createLabel(result.data.name, result.data.color, result.data.icon || '🏷️')
    return NextResponse.json(label, { status: 201 })
  } catch (error) {
    console.error('Label creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const result = patchLabelSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const { id, action, data } = result.data

    if (action === 'delete') {
      deleteLabel(id)
      return NextResponse.json({ success: true })
    }

    if (action === 'update' && data) {
      // Note: updateLabel function would need to be added to tasks.ts
      return NextResponse.json({ error: 'Update not implemented yet' }, { status: 501 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Label patch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}