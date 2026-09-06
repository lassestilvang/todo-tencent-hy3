import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createRoom,
  getRooms,
  type RoomTimerMode,
} from '@/lib/focus/shared-focus-room'
import { parseJsonBody, RequestValidationError, validationErrorResponse } from '@/lib/validation'
import { randomBytes } from 'crypto'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().min(1).max(500),
  memberName: z.string().min(1).max(200),
})

/** List active focus rooms in a workspace. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params
  const rooms = getRooms(workspaceId)
  return NextResponse.json({ rooms })
}

/** Create a new focus room. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params

  try {
    const body = await parseJsonBody(request, createSchema)
    const room = createRoom(
      workspaceId,
      body.name,
      body.clientId,
      body.memberName
    )
    return NextResponse.json({ room })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error)
    }
    console.error('Create room error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate a client id for the current device.
 * In a real app this would be tied to user auth; here we use a
 * random id stored in localStorage so the same device keeps the
 * same identity across page reloads.
 */
export async function GETClientId() {
  return `client_${randomBytes(8).toString('base64url')}`
}
