import 'server-only'

import { eq } from 'drizzle-orm'
import { pushSubscriptions } from '@/lib/db/schema'
import { getStoreDb } from '@/lib/db/instance'
import { generatePushSubscriptionId } from '@/lib/push-notifications'

export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userId?: string
}

export interface StoredPushSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  userId: string | null
  createdAt: number
  updatedAt: number
}

function mapRow(row: typeof pushSubscriptions.$inferSelect): StoredPushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userId: row.userId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// Save (or update) a push subscription. The endpoint is the subscription's
// identity: re-subscribing with the same endpoint rotates the keys.
export function saveSubscription(
  subscription: PushSubscriptionInput
): StoredPushSubscription {
  const db = getStoreDb()
  const now = Date.now()

  db.insert(pushSubscriptions).values({
    id: generatePushSubscriptionId(),
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    userId: subscription.userId ?? null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: pushSubscriptions.endpoint,
    set: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userId: subscription.userId ?? null,
      updatedAt: now,
    },
  }).run()

  return getSubscription(subscription.endpoint)!
}

export function getSubscription(endpoint: string): StoredPushSubscription | null {
  const db = getStoreDb()
  const row = db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .get()
  return row ? mapRow(row) : null
}

export function getAllSubscriptions(userId?: string): StoredPushSubscription[] {
  const db = getStoreDb()
  if (userId) {
    return db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .all()
      .map(mapRow)
  }
  return db.select().from(pushSubscriptions).all().map(mapRow)
}

export function removeSubscription(endpoint: string): boolean {
  const db = getStoreDb()
  const result = db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .run()
  return result.changes > 0
}
