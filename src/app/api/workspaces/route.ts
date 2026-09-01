import { NextRequest, NextResponse } from 'next/server'
import {
  createWorkspace,
  getWorkspaces,
  getUserWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  Workspace,
} from '@/lib/workspaces'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const workspaceId = searchParams.get('workspaceId')

    if (workspaceId) {
      const workspace = getWorkspace(workspaceId)
      if (!workspace) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      }
      return NextResponse.json({ workspace })
    }

    if (userId) {
      const workspaces = getUserWorkspaces(userId)
      return NextResponse.json({ workspaces })
    }

    const workspaces = getWorkspaces()
    return NextResponse.json({ workspaces })
  } catch (error) {
    console.error('Get workspaces error:', error)
    return NextResponse.json(
      { error: 'Failed to get workspaces' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, ownerId, ownerName, ownerEmail } = body

    if (!name || !ownerId || !ownerName || !ownerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: name, ownerId, ownerName, ownerEmail' },
        { status: 400 }
      )
    }

    const workspace = createWorkspace(name, ownerId, ownerName, ownerEmail, description)

    return NextResponse.json({
      success: true,
      workspace,
    })
  } catch (error) {
    console.error('Create workspace error:', error)
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, ...updates } = body

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspaceId' },
        { status: 400 }
      )
    }

    const workspace = updateWorkspace(workspaceId, updates)

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      workspace,
    })
  } catch (error) {
    console.error('Update workspace error:', error)
    return NextResponse.json(
      { error: 'Failed to update workspace' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspaceId' },
        { status: 400 }
      )
    }

    const success = deleteWorkspace(workspaceId)

    if (!success) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete workspace error:', error)
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    )
  }
}