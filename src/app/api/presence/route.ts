import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getActivePresence,
  recordPresence,
  prunePresence,
} from '@/lib/collaboration/presence'
import {
  parseJsonBody,
  RequestValidationError,
  validationErrorResponse,
} from '@/lib/validation'

const heartbeatSchema = z.object({
  workspaceId: z.string().min(1),
  clientId: z.string().min(1).max(500),
  name: z.string().min(1).max(500),
})

/** Who is currently present in a workspace. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Missing workspaceId parameter' },
      { status: 400 }
    )
  }

  // Reap stale heartbeats before answering, so
  // the list never reports gone clients.
  prunePresence()

  return NextResponse.json({
    presence: getActivePresence(workspaceId),
  })
}

/** Heartbeat: register (or refresh) this client's presence. */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(
      request,
      heartbeatSchema
    )

    recordPresence(body)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error)
    }
    console.error('Presence heartbeat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
