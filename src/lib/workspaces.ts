import { createHash, randomBytes } from 'crypto'

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

const WORKSPACES_KEY = 'workspaces'
const MEMBERS_KEY = 'workspace_members'
const INVITATIONS_KEY = 'workspace_invitations'
const ACTIVITY_KEY = 'workspace_activity'
const COMMENTS_KEY = 'task_comments'

function getStoredWorkspaces(): Workspace[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(WORKSPACES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveWorkspaces(workspaces: Workspace[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces))
}

function getStoredMembers(): WorkspaceMember[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(MEMBERS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveMembers(members: WorkspaceMember[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members))
}

function getStoredInvitations(): WorkspaceInvitation[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(INVITATIONS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveInvitations(invitations: WorkspaceInvitation[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations))
}

function getStoredActivity(): WorkspaceActivity[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ACTIVITY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveActivity(activity: WorkspaceActivity[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity))
}

function getStoredComments(): TaskComment[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(COMMENTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveComments(comments: TaskComment[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments))
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

export function createWorkspace(
  name: string,
  ownerId: string,
  ownerName: string,
  ownerEmail: string,
  description?: string
): Workspace {
  const workspaces = getStoredWorkspaces()
  const members = getStoredMembers()
  const now = Date.now()

  const workspace: Workspace = {
    id: generateWorkspaceId(),
    name,
    description,
    ownerId,
    createdAt: now,
    updatedAt: now,
    settings: {
      allowMemberInvites: true,
      allowPublicSharing: true,
      defaultListPermission: 'view',
      requireApprovalForJoin: false,
    },
  }

  const member: WorkspaceMember = {
    id: generateMemberId(),
    workspaceId: workspace.id,
    userId: ownerId,
    email: ownerEmail,
    name: ownerName,
    role: 'owner',
    joinedAt: now,
  }

  workspaces.push(workspace)
  members.push(member)
  saveWorkspaces(workspaces)
  saveMembers(members)

  // Log activity
  logActivity({
    workspaceId: workspace.id,
    userId: ownerId,
    userName: ownerName,
    action: 'created_workspace',
    details: `Created workspace "${name}"`,
    entityType: 'workspace',
    entityId: workspace.id,
  })

  return workspace
}

export function getWorkspaces(): Workspace[] {
  return getStoredWorkspaces()
}

export function getWorkspace(id: string): Workspace | null {
  const workspaces = getStoredWorkspaces()
  return workspaces.find(w => w.id === id) || null
}

export function getUserWorkspaces(userId: string): Workspace[] {
  const workspaces = getStoredWorkspaces()
  const members = getStoredMembers()
  const userWorkspaceIds = members
    .filter(m => m.userId === userId)
    .map(m => m.workspaceId)
  return workspaces.filter(w => userWorkspaceIds.includes(w.id))
}

export function updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | null {
  const workspaces = getStoredWorkspaces()
  const index = workspaces.findIndex(w => w.id === id)
  if (index === -1) return null

  workspaces[index] = {
    ...workspaces[index],
    ...updates,
    updatedAt: Date.now(),
  }
  saveWorkspaces(workspaces)
  return workspaces[index]
}

export function deleteWorkspace(id: string): boolean {
  const workspaces = getStoredWorkspaces()
  const index = workspaces.findIndex(w => w.id === id)
  if (index === -1) return false

  workspaces.splice(index, 1)
  saveWorkspaces(workspaces)

  // Clean up related data
  const members = getStoredMembers().filter(m => m.workspaceId !== id)
  saveMembers(members)

  const invitations = getStoredInvitations().filter(i => i.workspaceId !== id)
  saveInvitations(invitations)

  const activity = getStoredActivity().filter(a => a.workspaceId !== id)
  saveActivity(activity)

  return true
}

// Member management
export function getWorkspaceMembers(workspaceId: string): WorkspaceMember[] {
  const members = getStoredMembers()
  return members.filter(m => m.workspaceId === workspaceId)
}

export function getMember(workspaceId: string, userId: string): WorkspaceMember | null {
  const members = getStoredMembers()
  return members.find(m => m.workspaceId === workspaceId && m.userId === userId) || null
}

export function addMember(
  workspaceId: string,
  userId: string,
  email: string,
  name: string,
  role: WorkspaceRole = 'member'
): WorkspaceMember {
  const members = getStoredMembers()
  const workspace = getWorkspace(workspaceId)

  const member: WorkspaceMember = {
    id: generateMemberId(),
    workspaceId,
    userId,
    email,
    name,
    role,
    joinedAt: Date.now(),
  }

  members.push(member)
  saveMembers(members)

  if (workspace) {
    logActivity({
      workspaceId,
      userId,
      userName: name,
      action: 'member_joined',
      details: `${name} joined the workspace as ${role}`,
      entityType: 'member',
      entityId: member.id,
    })
  }

  return member
}

export function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
): WorkspaceMember | null {
  const members = getStoredMembers()
  const index = members.findIndex(m => m.workspaceId === workspaceId && m.userId === userId)
  if (index === -1) return null

  const oldRole = members[index].role
  members[index].role = role
  saveMembers(members)

  const workspace = getWorkspace(workspaceId)
  if (workspace) {
    logActivity({
      workspaceId,
      userId,
      userName: members[index].name,
      action: 'role_changed',
      details: `Role changed from ${oldRole} to ${role}`,
      entityType: 'member',
      entityId: members[index].id,
    })
  }

  return members[index]
}

export function removeMember(workspaceId: string, userId: string): boolean {
  const members = getStoredMembers()
  const index = members.findIndex(m => m.workspaceId === workspaceId && m.userId === userId)
  if (index === -1) return false

  const member = members[index]
  members.splice(index, 1)
  saveMembers(members)

  const workspace = getWorkspace(workspaceId)
  if (workspace) {
    logActivity({
      workspaceId,
      userId,
      userName: member.name,
      action: 'member_left',
      details: `${member.name} left the workspace`,
      entityType: 'member',
      entityId: member.id,
    })
  }

  return true
}

// Invitations
export function createInvitation(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  invitedBy: string,
  invitedByName: string
): WorkspaceInvitation {
  const invitations = getStoredInvitations()
  const now = Date.now()
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000 // 7 days

  const invitation: WorkspaceInvitation = {
    id: `inv_${randomBytes(12).toString('base64url')}`,
    workspaceId,
    email,
    role,
    invitedBy,
    invitedByName,
    status: 'pending',
    token: generateInvitationToken(),
    expiresAt,
    createdAt: now,
  }

  invitations.push(invitation)
  saveInvitations(invitations)

  const workspace = getWorkspace(workspaceId)
  if (workspace) {
    logActivity({
      workspaceId,
      userId: invitedBy,
      userName: invitedByName,
      action: 'invitation_sent',
      details: `Invited ${email} as ${role}`,
      entityType: 'invitation',
      entityId: invitation.id,
    })
  }

  return invitation
}

export function getInvitation(token: string): WorkspaceInvitation | null {
  const invitations = getStoredInvitations()
  return invitations.find(i => i.token === token) || null
}

export function getWorkspaceInvitations(workspaceId: string): WorkspaceInvitation[] {
  const invitations = getStoredInvitations()
  return invitations.filter(i => i.workspaceId === workspaceId)
}

export function acceptInvitation(token: string, userId: string, userName: string): { success: boolean; workspace?: Workspace; error?: string } {
  const invitations = getStoredInvitations()
  const index = invitations.findIndex(i => i.token === token)

  if (index === -1) {
    return { success: false, error: 'Invalid invitation' }
  }

  const invitation = invitations[index]

  if (invitation.status !== 'pending') {
    return { success: false, error: 'Invitation already used' }
  }

  if (Date.now() > invitation.expiresAt) {
    return { success: false, error: 'Invitation expired' }
  }

  const workspace = getWorkspace(invitation.workspaceId)
  if (!workspace) {
    return { success: false, error: 'Workspace not found' }
  }

  // Add member
  addMember(invitation.workspaceId, userId, invitation.email, userName, invitation.role)

  // Update invitation
  invitation.status = 'accepted'
  invitation.acceptedAt = Date.now()
  saveInvitations(invitations)

  return { success: true, workspace }
}

export function declineInvitation(token: string): boolean {
  const invitations = getStoredInvitations()
  const index = invitations.findIndex(i => i.token === token)
  if (index === -1) return false

  invitations[index].status = 'declined'
  saveInvitations(invitations)
  return true
}

export function revokeInvitation(invitationId: string): boolean {
  const invitations = getStoredInvitations()
  const index = invitations.findIndex(i => i.id === invitationId)
  if (index === -1) return false

  invitations.splice(index, 1)
  saveInvitations(invitations)
  return true
}

// Activity
export function logActivity(activity: Omit<WorkspaceActivity, 'id' | 'createdAt'>): WorkspaceActivity {
  const activities = getStoredActivity()

  const newActivity: WorkspaceActivity = {
    ...activity,
    id: generateActivityId(),
    createdAt: Date.now(),
  }

  activities.unshift(newActivity)
  // Keep only last 1000 activities per workspace
  const workspaceActivities = activities.filter(a => a.workspaceId === activity.workspaceId)
  if (workspaceActivities.length > 1000) {
    const toRemove = workspaceActivities.slice(1000).map(a => a.id)
    const filtered = activities.filter(a => !toRemove.includes(a.id))
    saveActivity(filtered)
  } else {
    saveActivity(activities)
  }

  return newActivity
}

export function getWorkspaceActivity(workspaceId: string, limit = 50): WorkspaceActivity[] {
  const activities = getStoredActivity()
  return activities
    .filter(a => a.workspaceId === workspaceId)
    .slice(0, limit)
}

// Comments
export function addComment(
  taskId: string,
  workspaceId: string,
  userId: string,
  userName: string,
  content: string,
  userAvatar?: string
): TaskComment {
  const comments = getStoredComments()

  // Extract mentions (@username)
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1])
  }

  const comment: TaskComment = {
    id: generateCommentId(),
    taskId,
    workspaceId,
    userId,
    userName,
    userAvatar,
    content,
    mentions,
    createdAt: Date.now(),
  }

  comments.push(comment)
  saveComments(comments)

  logActivity({
    workspaceId,
    userId,
    userName,
    action: 'comment_added',
    details: `Commented on task`,
    entityType: 'comment',
    entityId: comment.id,
  })

  return comment
}

export function getTaskComments(taskId: string): TaskComment[] {
  const comments = getStoredComments()
  return comments
    .filter(c => c.taskId === taskId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export function updateComment(commentId: string, content: string, userId: string): TaskComment | null {
  const comments = getStoredComments()
  const index = comments.findIndex(c => c.id === commentId && c.userId === userId)
  if (index === -1) return null

  // Extract mentions
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1])
  }

  comments[index] = {
    ...comments[index],
    content,
    mentions,
    updatedAt: Date.now(),
  }
  saveComments(comments)
  return comments[index]
}

export function deleteComment(commentId: string, userId: string): boolean {
  const comments = getStoredComments()
  const index = comments.findIndex(c => c.id === commentId && c.userId === userId)
  if (index === -1) return false

  comments.splice(index, 1)
  saveComments(comments)
  return true
}

// Utility
export function getUserRole(workspaceId: string, userId: string): WorkspaceRole | null {
  const member = getMember(workspaceId, userId)
  return member?.role || null
}

export function canUserManageWorkspace(workspaceId: string, userId: string): boolean {
  const role = getUserRole(workspaceId, userId)
  return role === 'owner' || role === 'admin'
}

export function canUserInvite(workspaceId: string, userId: string): boolean {
  const workspace = getWorkspace(workspaceId)
  const member = getMember(workspaceId, userId)
  if (!member) return false
  if (member.role === 'owner' || member.role === 'admin') return true
  return workspace?.settings.allowMemberInvites === true
}

export function getInvitationUrl(token: string): string {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/workspace/invite/${token}`
}