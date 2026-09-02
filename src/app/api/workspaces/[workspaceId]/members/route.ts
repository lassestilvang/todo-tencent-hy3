import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkspaceMembers,
  addMember,
  updateMemberRole,
  removeMember,
  getMember,
  canUserManageWorkspace,
  WorkspaceRole,
} from '@/lib/workspaces'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (userId) {
      const member = getMember(workspaceId, userId)
      if (!member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      }
      return NextResponse.json({ member })
    }

    const members = getWorkspaceMembers(workspaceId)
    return NextResponse.json({ members })
  } catch (error) {
    console.error('Get workspace members error:', error)
    return NextResponse.json(
      { error: 'Failed to get members' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const body = await request.json()
    const { userId, email, name, role, requestedBy } = body

    if (!userId || !email || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, name' },
        { status: 400 }
      )
    }

    // Check permissions
    if (requestedBy && !canUserManageWorkspace(workspaceId, requestedBy)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to add members' },
        { status: 403 }
      )
    }

    const member = addMember(workspaceId, userId, email, name, role || 'member')

    return NextResponse.json({
      success: true,
      member,
    })
  } catch (error) {
    console.error('Add member error:', error)
    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const body = await request.json()
    const { userId, role, requestedBy } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, role' },
        { status: 400 }
      )
    }

    const validRoles: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Check permissions
    if (requestedBy && !canUserManageWorkspace(workspaceId, requestedBy)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to change roles' },
        { status: 403 }
      )
    }

    // Prevent demoting the owner
    const member = getMember(workspaceId, userId)
    if (member?.role === 'owner' && role !== 'owner') {
      return NextResponse.json(
        { error: 'Cannot change owner role' },
        { status: 400 }
      )
    }

    const updatedMember = updateMemberRole(workspaceId, userId, role)

    if (!updatedMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
    })
  } catch (error) {
    console.error('Update member role error:', error)
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const requestedBy = searchParams.get('requestedBy')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Check permissions (unless removing themselves)
    if (requestedBy && requestedBy !== userId && !canUserManageWorkspace(workspaceId, requestedBy)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove members' },
        { status: 403 }
      )
    }

    // Prevent removing the owner
    const member = getMember(workspaceId, userId)
    if (member?.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove workspace owner' },
        { status: 400 }
      )
    }

    const success = removeMember(workspaceId, userId)

    if (!success) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    )
  }
}