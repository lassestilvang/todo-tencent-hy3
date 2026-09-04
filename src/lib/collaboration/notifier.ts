/**
 * Server-side assignment notifications.
 *
 * Delivers the notification built by
 * `assignment.ts` as push messages to every
 * device the assignee registered. Never
 * import this from client code — it reads
 * the database and the VAPID private key.
 */
import 'server-only'

import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { workspaceMembers } from '@/lib/db/schema'
import { getStoreDb } from '@/lib/db/instance'
import { getAllSubscriptions } from '@/lib/push-store'
import { buildAssignmentNotification } from './assignment'

export interface AssignmentNotice {
  taskId: string
  taskName: string
  /** Member the task is now assigned to */
  assigneeId: string | null
  assignerName?: string
}

let vapidConfigured: boolean | null = null

/**
 * Test seam: the VAPID configuration is
 * latched after the first delivery attempt,
 * so tests that vary the environment reset
 * the latch first.
 */
export function resetVapidConfigurationForTesting(): void {
  vapidConfigured = null
}

/** Configure web-push once; false when VAPID keys are missing. */
function configureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (publicKey && privateKey) {
    webpush.setVapidDetails(
      'mailto:admin@taskflow.app',
      publicKey,
      privateKey
    )
    vapidConfigured = true
  } else {
    vapidConfigured = false
  }

  return vapidConfigured
}

/**
 * Notify the assignee's devices that a task
 * was assigned to them. Returns how many
 * messages were delivered; an unassigned,
 * unknown or subscription-less member
 * delivers nothing. Delivery failures on
 * individual devices are logged, not thrown.
 */
export async function notifyTaskAssignment(
  notice: AssignmentNotice
): Promise<number> {
  if (!notice.assigneeId) return 0

  const db = getStoreDb()
  const member = db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, notice.assigneeId))
    .get()

  if (!member) return 0

  const notification = buildAssignmentNotification({
    task: { id: notice.taskId, name: notice.taskName },
    assignee: { id: member.id, name: member.name },
    assignerName: notice.assignerName,
  })

  const subscriptions = getAllSubscriptions(member.userId)
  if (subscriptions.length === 0) return 0

  if (!configureVapid()) {
    console.warn(
      'Assignment notification skipped: VAPID keys are not configured'
    )
    return 0
  }

  let delivered = 0
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(notification)
      )
      delivered += 1
    } catch (error) {
      console.error(
        'Failed to deliver assignment notification:',
        error
      )
    }
  }

  return delivered
}
