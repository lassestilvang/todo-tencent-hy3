import { NextRequest, NextResponse } from 'next/server'
import { getTemplates, createTemplate } from '@/lib/tasks'

export async function GET() {
  try {
    const templates = getTemplates()
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Get templates error:', error)
    return NextResponse.json(
      { error: 'Failed to get templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, priority, estimate, recurring, listId, tags } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const template = createTemplate({
      name,
      description,
      priority,
      estimate,
      recurring,
      listId,
      tags,
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Create template error:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}