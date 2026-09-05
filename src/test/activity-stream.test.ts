import {
  subscribeToWorkspace,
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

beforeEach(() => {
  resetActivityStream()
})

describe('activity stream', () => {
  it('delivers events to a subscriber', () => {
    const received: WorkspaceActivity[] = []
    subscribeToWorkspace('ws-1', (event) =>
      received.push(event)
    )

    publishActivity(activity('ws-1'))

    expect(received).toHaveLength(1)
    expect(received[0].action).toBe('member.added')
  })

  it('does not deliver events for other workspaces', () => {
    const received: WorkspaceActivity[] = []
    subscribeToWorkspace('ws-1', (event) =>
      received.push(event)
    )

    publishActivity(activity('ws-2'))

    expect(received).toHaveLength(0)
  })

  it('delivers to every subscriber', () => {
    const first: WorkspaceActivity[] = []
    const second: WorkspaceActivity[] = []
    subscribeToWorkspace('ws-1', (event) =>
      first.push(event)
    )
    subscribeToWorkspace('ws-1', (event) =>
      second.push(event)
    )

    publishActivity(activity('ws-1'))

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
  })

  it('stops delivering after unsubscribe', () => {
    const received: WorkspaceActivity[] = []
    const unsubscribe = subscribeToWorkspace(
      'ws-1',
      (event) => received.push(event)
    )

    publishActivity(activity('ws-1'))
    unsubscribe()
    publishActivity(activity('ws-1'))

    expect(received).toHaveLength(1)
  })

  it('drops the workspace when its last subscriber leaves', () => {
    const unsubscribe = subscribeToWorkspace(
      'ws-1',
      () => undefined
    )

    expect(subscribedWorkspaces()).toContain('ws-1')

    unsubscribe()

    expect(subscribedWorkspaces()).not.toContain(
      'ws-1'
    )
  })

  it('isolates a throwing listener', () => {
    const received: WorkspaceActivity[] = []
    subscribeToWorkspace('ws-1', () => {
      throw new Error('listener exploded')
    })
    subscribeToWorkspace('ws-1', (event) =>
      received.push(event)
    )

    // The throwing listener must not
    // break the broadcast.
    expect(() =>
      publishActivity(activity('ws-1'))
    ).not.toThrow()
    expect(received).toHaveLength(1)
  })
})
