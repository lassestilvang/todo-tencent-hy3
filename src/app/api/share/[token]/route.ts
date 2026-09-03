import { NextRequest, NextResponse } from 'next/server'
import { revokeShareLink, validateShareAccess } from '@/lib/share-store'
import { getTasks, getLists } from '@/lib/tasks'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const success = revokeShareLink(token)

    if (!success) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Revoke share link error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke share link' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password') || undefined

    const validation = validateShareAccess(token, password)

    if (!validation.valid || !validation.link) {
      return NextResponse.json(
        { error: validation.error || 'Invalid share link' },
        { status: 404 }
      )
    }

    const lists = await getLists()
    const list = lists.find(l => l.id === validation.link?.listId)
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const tasks = await getTasks({
      listId: validation.link.listId,
      completed: validation.link.permission !== 'view',
    })

    return NextResponse.json({
      list: {
        id: list.id,
        name: list.name,
        color: list.color,
        emoji: list.emoji,
      },
      tasks: tasks.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description,
        date: task.date,
        deadline: task.deadline,
        estimate: task.estimate,
        priority: task.priority,
        completed: task.completed,
        position: task.position,
      })),
      shareInfo: {
        permission: validation.link.permission,
        expiresAt: validation.link.expiresAt,
        ownerName: 'TaskFlow User',
      },
    })
  } catch (error) {
    console.error('Get shared list error:', error)
    return NextResponse.json(
      { error: 'Failed to load shared list' },
      { status: 500 }
    )
  }
}