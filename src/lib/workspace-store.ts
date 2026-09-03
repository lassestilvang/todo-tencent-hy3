import { randomBytes } from 'crypto'
import 'server-only'

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  workspaceActivity,
  taskComments,
} from '@/lib/db/schema'
import { getStoreDb } from '@/lib/db/instance'
import {
  generateWorkspaceId,
  generateInvitationToken,
  generateMemberId,
  generateActivityId,
  generateCommentId,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceInvitation,
  type WorkspaceActivity,
  type TaskComment,
  type WorkspaceRole,
} from '@/lib/workspaces'

const MAX_ACTIVITIES_PER_WORKSPACE = 1000

function mapWorkspaceRow(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    settings: JSON.parse(row.settings) as Workspace['settings'],
  }
}

function mapMemberRow(row: typeof workspaceMembers.$inferSelect): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    email: row.email,
    name: row.name,
    role: row.role,
    joinedAt: row.joinedAt,
    avatarUrl: row.avatarUrl ?? undefined,
  }
}

function mapInvitationRow(row: typeof workspaceInvitations.$inferSelect): WorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    invitedBy: row.invitedBy,
    invitedByName: row.invitedByName,
    status: row.status,
    token: row.token,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt ?? undefined,
  }
}

function mapActivityRow(row: typeof workspaceActivity.$inferSelect): WorkspaceActivity {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    userName: row.userName,
    action: row.action,
    details: row.details,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
  }
}

function mapCommentRow(row: typeof taskComments.$inferSelect): TaskComment {
  return {
    id: row.id,
    taskId: row.taskId,
    workspaceId: row.workspaceId,
    userId: row.userId,
    userName: row.userName,
    userAvatar: row.userAvatar ?? undefined,
    content: row.content,
    mentions: JSON.parse(row.mentions) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? undefined,
  }
}

// Extract @username mentions from comment content
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1])
  }
  return mentions
}

export function createWorkspace(
  name: string,
  ownerId: string,
  ownerName: string,
  ownerEmail: string,
  description?: string
): Workspace {
  const db = getStoreDb()
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

  db.insert(workspaces).values({
    id: workspace.id,
    name: workspace.name,
    description: workspace.description ?? null,
    ownerId: workspace.ownerId,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    settings: JSON.stringify(workspace.settings),
  }).run()

  db.insert(workspaceMembers).values({
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    email: member.email,
    name: member.name,
    role: member.role,
    joinedAt: member.joinedAt,
    avatarUrl: member.avatarUrl ?? null,
  }).run()

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
  const db = getStoreDb()
  return db.select().from(workspaces).all().map(mapWorkspaceRow)
}

export function getWorkspace(id: string): Workspace | null {
  const db = getStoreDb()
  const row = db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  return row ? mapWorkspaceRow(row) : null
}

export function getUserWorkspaces(userId: string): Workspace[] {
  const db = getStoreDb()
  const memberships = db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .all()

  if (memberships.length === 0) return []

  const workspaceIds = memberships.map(m => m.workspaceId)
  return db
    .select()
    .from(workspaces)
    .where(inArray(workspaces.id, workspaceIds))
    .all()
    .map(mapWorkspaceRow)
}

export function updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | null {
  const db = getStoreDb()
  const existing = getWorkspace(id)
  if (!existing) return null

  const workspace: Workspace = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  }

  db.update(workspaces).set({
    name: workspace.name,
    description: workspace.description ?? null,
    ownerId: workspace.ownerId,
    updatedAt: workspace.updatedAt,
    settings: JSON.stringify(workspace.settings),
  }).where(eq(workspaces.id, id)).run()

  return workspace
}

export function deleteWorkspace(id: string): boolean {
  const db = getStoreDb()
  const existing = db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  if (!existing) return false

  db.delete(workspaces).where(eq(workspaces.id, id)).run()

  // Clean up related data
  db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, id)).run()
  db.delete(workspaceInvitations).where(eq(workspaceInvitations.workspaceId, id)).run()
  db.delete(workspaceActivity).where(eq(workspaceActivity.workspaceId, id)).run()
  db.delete(taskComments).where(eq(taskComments.workspaceId, id)).run()

  return true
}

// Member management
export function getWorkspaceMembers(workspaceId: string): WorkspaceMember[] {
  const db = getStoreDb()
  return db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .all()
    .map(mapMemberRow)
}

export function getMember(workspaceId: string, userId: string): WorkspaceMember | null {
  const db = getStoreDb()
  const row = db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .get()
  return row ? mapMemberRow(row) : null
}

export function addMember(
  workspaceId: string,
  userId: string,
  email: string,
  name: string,
  role: WorkspaceRole = 'member'
): WorkspaceMember {
  const db = getStoreDb()
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

  db.insert(workspaceMembers).values({
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    email: member.email,
    name: member.name,
    role: member.role,
    joinedAt: member.joinedAt,
    avatarUrl: member.avatarUrl ?? null,
  }).run()

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
  const db = getStoreDb()
  const existing = getMember(workspaceId, userId)
  if (!existing) return null

  const oldRole = existing.role
  const member: WorkspaceMember = { ...existing, role }

  db.update(workspaceMembers)
    .set({ role })
    .where(eq(workspaceMembers.id, existing.id))
    .run()

  const workspace = getWorkspace(workspaceId)
  if (workspace) {
    logActivity({
      workspaceId,
      userId,
      userName: member.name,
      action: 'role_changed',
      details: `Role changed from ${oldRole} to ${role}`,
      entityType: 'member',
      entityId: member.id,
    })
  }

  return member
}

export function removeMember(workspaceId: string, userId: string): boolean {
  const db = getStoreDb()
  const existing = getMember(workspaceId, userId)
  if (!existing) return false

  db.delete(workspaceMembers).where(eq(workspaceMembers.id, existing.id)).run()

  const workspace = getWorkspace(workspaceId)
  if (workspace) {
    logActivity({
      workspaceId,
      userId,
      userName: existing.name,
      action: 'member_left',
      details: `${existing.name} left the workspace`,
      entityType: 'member',
      entityId: existing.id,
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
  const db = getStoreDb()
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

  db.insert(workspaceInvitations).values({
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    invitedBy: invitation.invitedBy,
    invitedByName: invitation.invitedByName,
    status: invitation.status,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    acceptedAt: invitation.acceptedAt ?? null,
  }).run()

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
  const db = getStoreDb()
  const row = db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.token, token))
    .get()
  return row ? mapInvitationRow(row) : null
}

export function getWorkspaceInvitations(workspaceId: string): WorkspaceInvitation[] {
  const db = getStoreDb()
  return db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.workspaceId, workspaceId))
    .all()
    .map(mapInvitationRow)
}

export function acceptInvitation(
  token: string,
  userId: string,
  userName: string
): { success: boolean; workspace?: Workspace; error?: string } {
  const invitation = getInvitation(token)

  if (!invitation) {
    return { success: false, error: 'Invalid invitation' }
  }

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
  const db = getStoreDb()
  db.update(workspaceInvitations)
    .set({ status: 'accepted', acceptedAt: Date.now() })
    .where(eq(workspaceInvitations.id, invitation.id))
    .run()

  return { success: true, workspace }
}

export function declineInvitation(token: string): boolean {
  const db = getStoreDb()
  const invitation = getInvitation(token)
  if (!invitation) return false

  db.update(workspaceInvitations)
    .set({ status: 'declined' })
    .where(eq(workspaceInvitations.id, invitation.id))
    .run()

  return true
}

export function revokeInvitation(invitationId: string): boolean {
  const db = getStoreDb()
  const result = db
    .delete(workspaceInvitations)
    .where(eq(workspaceInvitations.id, invitationId))
    .run()
  return result.changes > 0
}

// Activity
export function logActivity(activity: Omit<WorkspaceActivity, 'id' | 'createdAt'>): WorkspaceActivity {
  const db = getStoreDb()

  const newActivity: WorkspaceActivity = {
    ...activity,
    id: generateActivityId(),
    createdAt: Date.now(),
  }

  db.insert(workspaceActivity).values({
    id: newActivity.id,
    workspaceId: newActivity.workspaceId,
    userId: newActivity.userId,
    userName: newActivity.userName,
    action: newActivity.action,
    details: newActivity.details,
    entityType: newActivity.entityType,
    entityId: newActivity.entityId,
    createdAt: newActivity.createdAt,
  }).run()

  // Keep only the 1000 most recent activities per workspace
  const countRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(workspaceActivity)
    .where(eq(workspaceActivity.workspaceId, activity.workspaceId))
    .get()
  const total = countRow?.count ?? 0

  if (total > MAX_ACTIVITIES_PER_WORKSPACE) {
    const stale = db
      .select({ id: workspaceActivity.id })
      .from(workspaceActivity)
      .where(eq(workspaceActivity.workspaceId, activity.workspaceId))
      .orderBy(asc(workspaceActivity.createdAt), asc(workspaceActivity.id))
      .limit(total - MAX_ACTIVITIES_PER_WORKSPACE)
      .all()

    db.delete(workspaceActivity)
      .where(inArray(workspaceActivity.id, stale.map(s => s.id)))
      .run()
  }

  return newActivity
}

export function getWorkspaceActivity(workspaceId: string, limit = 50): WorkspaceActivity[] {
  const db = getStoreDb()
  return db
    .select()
    .from(workspaceActivity)
    .where(eq(workspaceActivity.workspaceId, workspaceId))
    .orderBy(desc(workspaceActivity.createdAt), desc(workspaceActivity.id))
    .limit(limit)
    .all()
    .map(mapActivityRow)
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
  const db = getStoreDb()

  const comment: TaskComment = {
    id: generateCommentId(),
    taskId,
    workspaceId,
    userId,
    userName,
    userAvatar,
    content,
    mentions: extractMentions(content),
    createdAt: Date.now(),
  }

  db.insert(taskComments).values({
    id: comment.id,
    taskId: comment.taskId,
    workspaceId: comment.workspaceId,
    userId: comment.userId,
    userName: comment.userName,
    userAvatar: comment.userAvatar ?? null,
    content: comment.content,
    mentions: JSON.stringify(comment.mentions),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt ?? null,
  }).run()

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
  const db = getStoreDb()
  return db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt), asc(taskComments.id))
    .all()
    .map(mapCommentRow)
}

export function updateComment(commentId: string, content: string, userId: string): TaskComment | null {
  const db = getStoreDb()
  const existing = db
    .select()
    .from(taskComments)
    .where(and(eq(taskComments.id, commentId), eq(taskComments.userId, userId)))
    .get()

  if (!existing) return null

  const comment: TaskComment = {
    ...mapCommentRow(existing),
    content,
    mentions: extractMentions(content),
    updatedAt: Date.now(),
  }

  db.update(taskComments)
    .set({
      content: comment.content,
      mentions: JSON.stringify(comment.mentions),
      updatedAt: comment.updatedAt,
    })
    .where(eq(taskComments.id, commentId))
    .run()

  return comment
}

export function deleteComment(commentId: string, userId: string): boolean {
  const db = getStoreDb()
  const existing = db
    .select()
    .from(taskComments)
    .where(and(eq(taskComments.id, commentId), eq(taskComments.userId, userId)))
    .get()

  if (!existing) return false

  db.delete(taskComments).where(eq(taskComments.id, commentId)).run()

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
