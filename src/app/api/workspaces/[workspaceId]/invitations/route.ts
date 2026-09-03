import { NextRequest, NextResponse } from 'next/server'
import { getInvitationUrl } from '@/lib/workspaces'
import {
  createInvitation,
  getWorkspaceInvitations,
  getInvitation,
  revokeInvitation,
  canUserInvite,
} from '@/lib/workspace-store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token) {
      const invitation = getInvitation(token)
      if (!invitation) {
        return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
      }
      return NextResponse.json({ invitation })
    }

    const invitations = getWorkspaceInvitations(workspaceId)
    return NextResponse.json({ invitations })
  } catch (error) {
    console.error('Get invitations error:', error)
    return NextResponse.json(
      { error: 'Failed to get invitations' },
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
    const { email, role, invitedBy, invitedByName } = body

    if (!email || !role || !invitedBy || !invitedByName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, role, invitedBy, invitedByName' },
        { status: 400 }
      )
    }

    // Check permissions
    if (!canUserInvite(workspaceId, invitedBy)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to send invitations' },
        { status: 403 }
      )
    }

    const invitation = createInvitation(workspaceId, email, role, invitedBy, invitedByName)
    const invitationUrl = getInvitationUrl(invitation.token)

    return NextResponse.json({
      success: true,
      invitation: {
        ...invitation,
        url: invitationUrl,
      },
    })
  } catch (error) {
    console.error('Create invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('invitationId')

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Missing invitationId' },
        { status: 400 }
      )
    }

    const success = revokeInvitation(invitationId)

    if (!success) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Revoke invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    )
  }
}