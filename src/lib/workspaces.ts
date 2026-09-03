import { randomBytes } from 'crypto'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface Workspace {
  id: string
  name: string
  description?: string
  ownerId: string
  createdAt: number
  updatedAt: number
  settings: WorkspaceSettings
}

export interface WorkspaceSettings {
  allowMemberInvites: boolean
  allowPublicSharing: boolean
  defaultListPermission: 'view' | 'edit'
  requireApprovalForJoin: boolean
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  email: string
  name: string
  role: WorkspaceRole
  joinedAt: number
  avatarUrl?: string
}

export interface WorkspaceInvitation {
  id: string
  workspaceId: string
  email: string
  role: WorkspaceRole
  invitedBy: string
  invitedByName: string
  status: InvitationStatus
  token: string
  expiresAt: number
  createdAt: number
  acceptedAt?: number
}

export interface WorkspaceActivity {
  id: string
  workspaceId: string
  userId: string
  userName: string
  action: string
  details: string
  entityType: 'task' | 'list' | 'member' | 'invitation' | 'comment' | 'workspace'
  entityId: string
  createdAt: number
}

export interface TaskComment {
  id: string
  taskId: string
  workspaceId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  mentions: string[] // userIds mentioned
  createdAt: number
  updatedAt?: number
}

export function generateWorkspaceId(): string {
  return `ws_${randomBytes(12).toString('base64url')}`
}

export function generateInvitationToken(): string {
  return randomBytes(16).toString('base64url')
}

export function generateMemberId(): string {
  return `mem_${randomBytes(10).toString('base64url')}`
}

export function generateActivityId(): string {
  return `act_${randomBytes(10).toString('base64url')}`
}

export function generateCommentId(): string {
  return `cmt_${randomBytes(10).toString('base64url')}`
}

export function getInvitationUrl(token: string): string {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/workspace/invite/${token}`
}