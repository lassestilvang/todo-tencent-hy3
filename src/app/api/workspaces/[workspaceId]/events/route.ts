/**
 * Server-sent events stream of workspace activity.
 *
 * The dependency-free real-time channel: any
 * client (browser EventSource, curl, an
 * integration) can watch a workspace's
 * collaboration events — member changes,
 * invitations, comments — as they are logged.
 * A heartbeat comment frame keeps proxies
 * from closing idle streams.
 */

import type { NextRequest } from 'next/server'
import { subscribeToWorkspace } from '@/lib/collaboration/activity-stream'

const HEARTBEAT_MS = 25_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )
      }

      // SSE comment frames are ignored by
      // EventSource but keep the connection alive.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, HEARTBEAT_MS)

      const unsubscribe = subscribeToWorkspace(
        workspaceId,
        send
      )

      // The signal fires when the client
      // disconnects; release the subscription.
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })
}
