import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getRoom,
  joinRoom,
  leaveRoom,
  updateSession,
  resetSession,
  completeSegment,
  tickSession,
} from '@/lib/focus/shared-focus-room'
import {
  parseJsonBody,
  RequestValidationError,
  validationErrorResponse,
} from '@/lib/validation'

const joinSchema = z.object({
  clientId: z.string().min(1).max(500),
  memberName: z.string().min(1).max(200),
})

const sessionUpdateSchema = z.object({
  isRunning: z.boolean().optional(),
  mode: z.enum(['pomodoro', 'shortBreak', 'longBreak']).optional(),
  timeRemaining: z.number().int().min(0).optional(),
  startedAt: z.number().nullable().optional(),
})

const tickSchema = z.object({
  clientId: z.string().min(1).max(500),
})

/** Get the current state of a focus room. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; roomId: string }> }
) {
  const { roomId } = await params
  const room = getRoom(roomId)

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  return NextResponse.json({ room })
}

/** Join, update session, tick, reset, or complete a segment in a room. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; roomId: string }> }
) {
  const { roomId } = await params
  const url = new URL(request.url)
  const action = url.searchParams.get('action') ?? 'join'

  const room = getRoom(roomId)
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  try {
    switch (action) {
      case 'join': {
        const body = await parseJsonBody(request, joinSchema)
        const updated = joinRoom(roomId, body.clientId, body.memberName)
        return NextResponse.json({ room: updated })
      }

      case 'leave': {
        const body = await parseJsonBody(request, joinSchema)
        const wasDeleted = leaveRoom(roomId, body.clientId)
        return NextResponse.json({ deleted: wasDeleted })
      }

      case 'update': {
        const body = await parseJsonBody(request, sessionUpdateSchema.extend({
          clientId: z.string().min(1).max(500),
        }))
        const { clientId, ...sessionUpdates } = body
        const updated = updateSession(roomId, clientId, sessionUpdates)
        return NextResponse.json({ room: updated })
      }

      case 'tick': {
        const body = await parseJsonBody(request, tickSchema)
        const updated = tickSession(roomId, body.clientId)
        return NextResponse.json({ room: updated })
      }

      case 'reset': {
        const body = await parseJsonBody(request, tickSchema)
        const updated = resetSession(roomId, body.clientId)
        return NextResponse.json({ room: updated })
      }

      case 'complete': {
        const body = await parseJsonBody(request, tickSchema)
        const updated = completeSegment(roomId, body.clientId)
        return NextResponse.json({ room: updated })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error)
    }
    console.error(`Room action ${action} error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
