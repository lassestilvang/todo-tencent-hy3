import { createHash, randomBytes } from 'crypto'

export type SharePermission = 'view' | 'comment' | 'edit'

export interface ShareLink {
  id: string
  token: string
  listId: string
  permission: SharePermission
  expiresAt?: number
  passwordHash?: string
  createdAt: number
  createdBy: string
  accessCount: number
  lastAccessed?: number
}

export interface SharedListData {
  list: {
    id: string
    name: string
    color: string
    emoji: string
  }
  tasks: {
    id: string
    name: string
    description?: string | null
    date?: string | null
    deadline?: string | null
    estimate?: number | null
    priority?: string
    completed: boolean
    position: number
  }[]
  shareInfo: {
    permission: SharePermission
    expiresAt?: number
    ownerName: string
  }
}

export function generateShareToken(): string {
  return randomBytes(16).toString('base64url')
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  const passwordHash = hashPassword(password)

  // Use timing-safe comparison to prevent timing attacks
  // crypto.timingSafeEqual is Node.js API, implement manually for browser
  try {
    if (passwordHash.length !== hash.length) return false

    let result = 0
    for (let i = 0; i < passwordHash.length; i++) {
      result |= passwordHash.charCodeAt(i) ^ hash.charCodeAt(i)
    }
    return result === 0
  } catch {
    // If lengths don't match, it's definitely not equal
    return false
  }
}

export function getShareUrl(token: string): string {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/share/${token}`
}

export function formatExpiryDate(expiresAt?: number): string {
  if (!expiresAt) return 'Never'
  const date = new Date(expiresAt)
  const now = new Date()
  const diffDays = Math.ceil((expiresAt - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'Expired'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return `In ${diffDays} days`
  return date.toLocaleDateString()
}

export function formatPermission(permission: SharePermission): string {
  const labels: Record<SharePermission, string> = {
    view: 'View only',
    comment: 'Comment',
    edit: 'Edit',
  }
  return labels[permission]
}

export function getPermissionColor(permission: SharePermission): string {
  const colors: Record<SharePermission, string> = {
    view: 'text-blue-600 bg-blue-100',
    comment: 'text-yellow-600 bg-yellow-100',
    edit: 'text-green-600 bg-green-100',
  }
  return colors[permission]
}