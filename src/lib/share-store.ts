import 'server-only'

import { eq, sql } from 'drizzle-orm'
import { shareLinks } from '@/lib/db/schema'
import { getStoreDb } from '@/lib/db/instance'
import {
  generateShareToken,
  hashPassword,
  verifyPassword,
  type ShareLink,
  type SharePermission,
} from '@/lib/share'

const SHARE_PREFIX = 'share_'

function mapRow(row: typeof shareLinks.$inferSelect): ShareLink {
  return {
    id: row.id,
    token: row.token,
    listId: row.listId,
    permission: row.permission,
    expiresAt: row.expiresAt ?? undefined,
    passwordHash: row.passwordHash ?? undefined,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    accessCount: row.accessCount,
    lastAccessed: row.lastAccessed ?? undefined,
  }
}

export function createShareLink(
  listId: string,
  permission: SharePermission,
  options?: {
    expiresInDays?: number
    password?: string
  }
): ShareLink {
  const db = getStoreDb()
  const token = generateShareToken()
  const now = Date.now()

  const link: ShareLink = {
    id: `${SHARE_PREFIX}${token}`,
    token,
    listId,
    permission,
    expiresAt: options?.expiresInDays ? now + options.expiresInDays * 24 * 60 * 60 * 1000 : undefined,
    passwordHash: options?.password ? hashPassword(options.password) : undefined,
    createdAt: now,
    createdBy: 'current-user', // In real app, get from auth
    accessCount: 0,
  }

  db.insert(shareLinks).values({
    id: link.id,
    token: link.token,
    listId: link.listId,
    permission: link.permission,
    expiresAt: link.expiresAt ?? null,
    passwordHash: link.passwordHash ?? null,
    createdAt: link.createdAt,
    createdBy: link.createdBy,
    accessCount: 0,
  }).run()

  return link
}

export function getShareLink(token: string): ShareLink | null {
  const db = getStoreDb()
  const row = db.select().from(shareLinks).where(eq(shareLinks.token, token)).get()
  return row ? mapRow(row) : null
}

export function getShareLinkById(id: string): ShareLink | null {
  const db = getStoreDb()
  const row = db.select().from(shareLinks).where(eq(shareLinks.id, id)).get()
  return row ? mapRow(row) : null
}

export function getListShareLinks(listId: string): ShareLink[] {
  const db = getStoreDb()
  return db.select().from(shareLinks).where(eq(shareLinks.listId, listId)).all().map(mapRow)
}

export function validateShareAccess(
  token: string,
  password?: string
): { valid: boolean; link?: ShareLink; error?: string } {
  const link = getShareLink(token)

  if (!link) {
    return { valid: false, error: 'Invalid or expired share link' }
  }

  if (link.expiresAt && Date.now() > link.expiresAt) {
    return { valid: false, error: 'Share link has expired' }
  }

  if (link.passwordHash) {
    if (!password) {
      return { valid: false, error: 'Password required' }
    }
    if (!verifyPassword(password, link.passwordHash)) {
      return { valid: false, error: 'Invalid password' }
    }
  }

  return { valid: true, link }
}

export function recordShareAccess(token: string): void {
  const db = getStoreDb()
  db.update(shareLinks)
    .set({
      accessCount: sql`${shareLinks.accessCount} + 1`,
      lastAccessed: Date.now(),
    })
    .where(eq(shareLinks.token, token))
    .run()
}

export function revokeShareLink(token: string): boolean {
  const db = getStoreDb()
  const result = db.delete(shareLinks).where(eq(shareLinks.token, token)).run()
  return result.changes > 0
}

export function revokeAllListShares(listId: string): number {
  const db = getStoreDb()
  const existing = db.select().from(shareLinks).where(eq(shareLinks.listId, listId)).all()
  if (existing.length === 0) return 0
  db.delete(shareLinks).where(eq(shareLinks.listId, listId)).run()
  return existing.length
}
