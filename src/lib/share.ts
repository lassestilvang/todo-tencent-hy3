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
  tasks: Array<{
    id: string
    name: string
    description?: string | null
    date?: string | null
    deadline?: string | null
    estimate?: number | null
    priority?: string
    completed: boolean
    position: number
  }>
  shareInfo: {
    permission: SharePermission
    expiresAt?: number
    ownerName: string
  }
}

const SHARE_LINKS_KEY = 'share_links'
const SHARE_PREFIX = 'share_'

function getStoredLinks(): ShareLink[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SHARE_LINKS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveLinks(links: ShareLink[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links))
}

export function generateShareToken(): string {
  return randomBytes(16).toString('base64url')
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function createShareLink(
  listId: string,
  permission: SharePermission,
  options?: {
    expiresInDays?: number
    password?: string
  }
): ShareLink {
  const links = getStoredLinks()
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

  links.push(link)
  saveLinks(links)
  return link
}

export function getShareLink(token: string): ShareLink | null {
  const links = getStoredLinks()
  return links.find(l => l.token === token) || null
}

export function getShareLinkById(id: string): ShareLink | null {
  const links = getStoredLinks()
  return links.find(l => l.id === id) || null
}

export function getListShareLinks(listId: string): ShareLink[] {
  const links = getStoredLinks()
  return links.filter(l => l.listId === listId)
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
  const links = getStoredLinks()
  const link = links.find(l => l.token === token)
  if (link) {
    link.accessCount++
    link.lastAccessed = Date.now()
    saveLinks(links)
  }
}

export function revokeShareLink(token: string): boolean {
  const links = getStoredLinks()
  const index = links.findIndex(l => l.token === token)
  if (index !== -1) {
    links.splice(index, 1)
    saveLinks(links)
    return true
  }
  return false
}

export function revokeAllListShares(listId: string): number {
  const links = getStoredLinks()
  const initialLength = links.length
  const filtered = links.filter(l => l.listId !== listId)
  saveLinks(filtered)
  return initialLength - filtered.length
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