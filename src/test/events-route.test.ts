/**
 * @jest-environment node
 *
 * The SSE route builds a streaming Response.
 */
"use strict";

import { NextRequest } from 'next/server'
import {
  GET as streamWorkspaceEvents,
} from '@/app/api/workspaces/[workspaceId]/events/route'
import {
  publishActivity,
  subscribedWorkspaces,
  resetActivityStream,
} from '@/lib/collaboration/activity-stream'
import type { WorkspaceActivity } from '@/lib/workspaces'

function activity(
  workspaceId: string,
  action = 'member.added'
): WorkspaceActivity {
  return {
    id: `activity-${workspaceId}-${action}`,
    workspaceId,
    userId: 'user-1',
    userName: 'Alex',
    action,
    details: 'Alex joined',
    entityType: 'member',
    entityId: 'member-1',
    createdAt: 1_791_000_000_000,
  }
}

/** Read one SSE frame, or 'nothing' if no frame arrives. */
async function readFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
  const result = await Promise.race([
    reader.read(),
    new Promise<{ done?: boolean; value?: Uint8Array }>(
      (resolve) =>
        setTimeout(
          () => resolve({ done: true }),
          50,
        ),
    ),
  ])
  if (result.done || !result.value) {
    return 'nothing'
  }
  return new TextDecoder().decode(result.value)
}

beforeEach(() => {
  resetActivityStream()
})

describe('GET /api/workspaces/[workspaceId]/events', () => {
  it('streams events as an SSE data frame', async () => {
    const controller = new AbortController()
    const request = new NextRequest(
      'https://taskflow.test/api/workspaces/ws-1/events',
      { signal: controller.signal }
    )

    const response = await streamWorkspaceEvents(
      request,
      { params: Promise.resolve({ workspaceId: 'ws-1' }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/event-stream'
    )
    expect(response.headers.get('cache-control')).toBe(
      'no-store'
    )

    const reader = (
      response.body as ReadableStream<Uint8Array>
    ).getReader()

    // Events for this workspace arrive as frames.
    publishActivity(activity('ws-1'))
    const frame = await readFrame(reader)
    const payload = JSON.parse(
      frame.replace(/^data: /, '').trim()
    )
    expect(payload).toMatchObject({
      workspaceId: 'ws-1',
      action: 'member.added',
    })

    // Other workspaces' events stay out.
    publishActivity(activity('ws-2'))
    expect(await readFrame(reader)).toBe('nothing')

    controller.abort()
  })

  it('subscribes the stream and releases it on disconnect', async () => {
    const controller = new AbortController()
    const request = new NextRequest(
      'https://taskflow.test/api/workspaces/ws-1/events',
      { signal: controller.signal }
    )

    await streamWorkspaceEvents(request, {
      params: Promise.resolve({ workspaceId: 'ws-1' }),
    })

    expect(subscribedWorkspaces()).toContain('ws-1')

    // The client hangs up: the subscription goes too.
    controller.abort()
    expect(subscribedWorkspaces()).not.toContain('ws-1')
  })
})
