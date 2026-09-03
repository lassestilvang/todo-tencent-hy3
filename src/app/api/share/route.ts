import { NextRequest, NextResponse } from 'next/server'
import { getShareUrl, type SharePermission } from '@/lib/share'
import { createShareLink, getListShareLinks } from '@/lib/share-store'
import { getLists } from '@/lib/tasks'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { listId, permission, expiresInDays, password } = body

    if (!listId || !permission) {
      return NextResponse.json(
        { error: 'Missing required fields: listId, permission' },
        { status: 400 }
      )
    }

    if (!['view', 'comment', 'edit'].includes(permission)) {
      return NextResponse.json(
        { error: 'Invalid permission. Must be view, comment, or edit' },
        { status: 400 }
      )
    }

    // Verify list exists
    const lists = await getLists()
    const list = lists.find(l => l.id === listId)
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const link = createShareLink(listId, permission as SharePermission, {
      expiresInDays,
      password,
    })

    const shareUrl = getShareUrl(link.token)

    return NextResponse.json({
      success: true,
      shareLink: {
        id: link.id,
        token: link.token,
        url: shareUrl,
        permission: link.permission,
        expiresAt: link.expiresAt,
        hasPassword: !!link.passwordHash,
        createdAt: link.createdAt,
      },
    })
  } catch (error) {
    console.error('Create share link error:', error)
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const listId = searchParams.get('listId')

    if (!listId) {
      return NextResponse.json(
        { error: 'Missing listId parameter' },
        { status: 400 }
      )
    }

    const links = getListShareLinks(listId)

    return NextResponse.json({
      links: links.map(link => ({
        id: link.id,
        token: link.token,
        url: getShareUrl(link.token),
        permission: link.permission,
        expiresAt: link.expiresAt,
        hasPassword: !!link.passwordHash,
        createdAt: link.createdAt,
        accessCount: link.accessCount,
        lastAccessed: link.lastAccessed,
      })),
    })
  } catch (error) {
    console.error('Get share links error:', error)
    return NextResponse.json(
      { error: 'Failed to get share links' },
      { status: 500 }
    )
  }
}