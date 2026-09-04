import { eq } from 'drizzle-orm'
import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/db/instance'
import { workspaceInvitations, workspaces } from '@/lib/db/schema'

// Set up test database before importing the workspace store
setDbInstanceForTesting(testDb)

import {
  createWorkspace,
  getWorkspaces,
  getWorkspace,
  getUserWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  getMember,
  addMember,
  updateMemberRole,
  removeMember,
  createInvitation,
  getInvitation,
  getWorkspaceInvitations,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
  logActivity,
  getWorkspaceActivity,
  addComment,
  getTaskComments,
  updateComment,
  deleteComment,
  getUserRole,
  canUserManageWorkspace,
  canUserInvite,
} from '@/lib/workspace-store'

describe('Workspaces', () => {
  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
  })

  describe('createWorkspace', () => {
    it('should create a workspace with default settings', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(workspace).toBeDefined()
      expect(workspace.id).toMatch(/^ws_/)
      expect(workspace.name).toBe('Engineering')
      expect(workspace.ownerId).toBe('user-1')
      expect(workspace.createdAt).toBeDefined()
      expect(workspace.updatedAt).toBeDefined()
      expect(workspace.settings).toEqual({
        allowMemberInvites: true,
        allowPublicSharing: true,
        defaultListPermission: 'view',
        requireApprovalForJoin: false,
      })
    })

    it('should store optional description', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com', 'Platform team')

      expect(workspace.description).toBe('Platform team')
    })

    it('should create owner membership', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const owner = getMember(workspace.id, 'user-1')

      expect(owner).toBeDefined()
      expect(owner!.role).toBe('owner')
      expect(owner!.name).toBe('Alice')
      expect(owner!.email).toBe('alice@example.com')
    })

    it('should log creation activity', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const activity = getWorkspaceActivity(workspace.id)

      expect(activity).toHaveLength(1)
      expect(activity[0].action).toBe('created_workspace')
      expect(activity[0].entityType).toBe('workspace')
    })

    it('should be retrievable after creation', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const stored = getWorkspace(workspace.id)

      expect(stored).toBeDefined()
      expect(stored!.name).toBe('Engineering')
    })
  })

  describe('getWorkspaces', () => {
    it('should return empty array when none exist', () => {
      expect(getWorkspaces()).toEqual([])
    })

    it('should return all workspaces', () => {
      createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      createWorkspace('Design', 'user-2', 'Bob', 'bob@example.com')

      expect(getWorkspaces()).toHaveLength(2)
    })
  })

  describe('getWorkspace', () => {
    it('should return null when not found', () => {
      expect(getWorkspace('ws_unknown')).toBeNull()
    })
  })

  describe('getUserWorkspaces', () => {
    it('should return workspaces the user is a member of', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob', 'member')
      createWorkspace('Design', 'user-3', 'Carol', 'carol@example.com')

      const userWorkspaces = getUserWorkspaces('user-2')

      expect(userWorkspaces).toHaveLength(1)
      expect(userWorkspaces[0].id).toBe(workspace.id)
    })

    it('should return empty array for unknown user', () => {
      createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(getUserWorkspaces('user-unknown')).toEqual([])
    })
  })

  describe('updateWorkspace', () => {
    it('should update name and description', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      const updated = updateWorkspace(workspace.id, { name: 'Platform', description: 'New desc' })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('Platform')
      expect(updated!.description).toBe('New desc')
    })

    it('should update settings', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      const updated = updateWorkspace(workspace.id, {
        settings: { ...workspace.settings, allowMemberInvites: false },
      })

      expect(updated!.settings.allowMemberInvites).toBe(false)
    })

    it('should update the timestamp', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const updated = updateWorkspace(workspace.id, { name: 'Platform' })

      expect(updated!.updatedAt).toBeGreaterThanOrEqual(workspace.updatedAt)
    })

    it('should return null when not found', () => {
      expect(updateWorkspace('ws_unknown', { name: 'Nope' })).toBeNull()
    })

    it('should persist settings changes', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      updateWorkspace(workspace.id, {
        settings: { ...workspace.settings, defaultListPermission: 'edit' },
      })

      const stored = getWorkspace(workspace.id)
      expect(stored!.settings.defaultListPermission).toBe('edit')
    })
  })

  describe('deleteWorkspace', () => {
    it('should remove the workspace', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      expect(getWorkspace(workspace.id)).toBeDefined()

      const result = deleteWorkspace(workspace.id)

      expect(result).toBe(true)
      expect(getWorkspace(workspace.id)).toBeNull()
    })

    it('should cascade delete members, invitations, activity and comments', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob')
      createInvitation(workspace.id, 'carol@example.com', 'member', 'user-1', 'Alice')
      addComment('task-1', workspace.id, 'user-1', 'Alice', 'First comment')

      const result = deleteWorkspace(workspace.id)

      expect(result).toBe(true)
      expect(getWorkspaceMembers(workspace.id)).toEqual([])
      expect(getWorkspaceInvitations(workspace.id)).toEqual([])
      expect(getWorkspaceActivity(workspace.id)).toEqual([])
      expect(getTaskComments('task-1')).toEqual([])
    })

    it('should return false when not found', () => {
      expect(deleteWorkspace('ws_unknown')).toBe(false)
    })
  })

  describe('getWorkspaceMembers', () => {
    it('should return only members of the workspace', () => {
      const workspace1 = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const workspace2 = createWorkspace('Design', 'user-2', 'Bob', 'bob@example.com')
      addMember(workspace1.id, 'user-3', 'carol@example.com', 'Carol')

      expect(getWorkspaceMembers(workspace1.id)).toHaveLength(2) // owner + carol
      expect(getWorkspaceMembers(workspace2.id)).toHaveLength(1)
    })
  })

  describe('getMember', () => {
    it('should return null when user is not a member', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(getMember(workspace.id, 'user-unknown')).toBeNull()
    })
  })

  describe('addMember', () => {
    it('should add a member with the given role', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      const member = addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob', 'admin')

      expect(member).toBeDefined()
      expect(member.id).toMatch(/^mem_/)
      expect(member.workspaceId).toBe(workspace.id)
      expect(member.userId).toBe('user-2')
      expect(member.email).toBe('bob@example.com')
      expect(member.name).toBe('Bob')
      expect(member.role).toBe('admin')
      expect(member.joinedAt).toBeDefined()
    })

    it('should default role to member', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      const member = addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob')

      expect(member.role).toBe('member')
    })

    it('should log member_joined activity', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob')

      const activity = getWorkspaceActivity(workspace.id)
      const joinActivity = activity.find(a => a.action === 'member_joined')

      expect(joinActivity).toBeDefined()
      expect(joinActivity!.entityType).toBe('member')
    })
  })

  describe('updateMemberRole', () => {
    it('should change the member role', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob')

      const member = updateMemberRole(workspace.id, 'user-2', 'admin')

      expect(member).toBeDefined()
      expect(member!.role).toBe('admin')
      expect(getMember(workspace.id, 'user-2')!.role).toBe('admin')
    })

    it('should return null when member not found', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(updateMemberRole(workspace.id, 'user-unknown', 'admin')).toBeNull()
    })

    it('should log role_changed activity', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob')
      updateMemberRole(workspace.id, 'user-2', 'admin')

      const activity = getWorkspaceActivity(workspace.id)
      expect(activity.find(a => a.action === 'role_changed')).toBeDefined()
    })
  })

  describe('removeMember', () => {
    it('should remove the member', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob')

      const result = removeMember(workspace.id, 'user-2')

      expect(result).toBe(true)
      expect(getMember(workspace.id, 'user-2')).toBeNull()
    })

    it('should return false when member not found', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(removeMember(workspace.id, 'user-unknown')).toBe(false)
    })

    it('should log member_left activity', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob')
      removeMember(workspace.id, 'user-2')

      const activity = getWorkspaceActivity(workspace.id)
      expect(activity.find(a => a.action === 'member_left')).toBeDefined()
    })
  })

  describe('createInvitation', () => {
    it('should create a pending invitation expiring in 7 days', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const before = Date.now()

      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')

      expect(invitation).toBeDefined()
      expect(invitation.id).toMatch(/^inv_/)
      expect(invitation.workspaceId).toBe(workspace.id)
      expect(invitation.email).toBe('bob@example.com')
      expect(invitation.role).toBe('member')
      expect(invitation.status).toBe('pending')
      expect(invitation.token).toBeDefined()
      expect(invitation.createdAt).toBeGreaterThanOrEqual(before)
      expect(invitation.expiresAt).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000)
      expect(invitation.expiresAt).toBeLessThan(before + 8 * 24 * 60 * 60 * 1000)
    })

    it('should be retrievable by token', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')

      expect(getInvitation(invitation.token)!.id).toBe(invitation.id)
    })
  })

  describe('getInvitation', () => {
    it('should return null for unknown token', () => {
      expect(getInvitation('unknown-token')).toBeNull()
    })
  })

  describe('getWorkspaceInvitations', () => {
    it('should return invitations for the workspace', () => {
      const workspace1 = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const workspace2 = createWorkspace('Design', 'user-2', 'Bob', 'bob@example.com')
      createInvitation(workspace1.id, 'a@example.com', 'member', 'user-1', 'Alice')
      createInvitation(workspace1.id, 'b@example.com', 'admin', 'user-1', 'Alice')
      createInvitation(workspace2.id, 'c@example.com', 'member', 'user-2', 'Bob')

      expect(getWorkspaceInvitations(workspace1.id)).toHaveLength(2)
    })
  })

  describe('acceptInvitation', () => {
    it('should add member and mark invitation accepted', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')

      const result = acceptInvitation(invitation.token, 'user-2', 'Bob')

      expect(result.success).toBe(true)
      expect(result.workspace!.id).toBe(workspace.id)
      expect(getMember(workspace.id, 'user-2')!.role).toBe('member')

      const updated = getInvitation(invitation.token)
      expect(updated!.status).toBe('accepted')
      expect(updated!.acceptedAt).toBeDefined()
    })

    it('should reject unknown token', () => {
      const result = acceptInvitation('unknown-token', 'user-2', 'Bob')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid invitation')
    })

    it('should reject already used invitation', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')
      acceptInvitation(invitation.token, 'user-2', 'Bob')

      const result = acceptInvitation(invitation.token, 'user-3', 'Carol')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invitation already used')
    })

    it('should reject expired invitation', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')

      // Force expiration directly in the database
      testDb.update(workspaceInvitations)
        .set({ expiresAt: Date.now() - 1000 })
        .where(eq(workspaceInvitations.id, invitation.id))
        .run()

      const result = acceptInvitation(invitation.token, 'user-2', 'Bob')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invitation expired')
    })

    it('should reject when workspace no longer exists', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')

      // Delete only the workspace row so the invitation is left orphaned
      // (deleteWorkspace cascades and would remove the invitation too)
      testDb.delete(workspaces).where(eq(workspaces.id, workspace.id)).run()

      const result = acceptInvitation(invitation.token, 'user-2', 'Bob')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Workspace not found')
    })
  })

  describe('declineInvitation', () => {
    it('should mark invitation declined', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')

      const result = declineInvitation(invitation.token)

      expect(result).toBe(true)
      expect(getInvitation(invitation.token)!.status).toBe('declined')
    })

    it('should return false for unknown token', () => {
      expect(declineInvitation('unknown-token')).toBe(false)
    })
  })

  describe('revokeInvitation', () => {
    it('should delete the invitation', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const invitation = createInvitation(workspace.id, 'bob@example.com', 'member', 'user-1', 'Alice')

      const result = revokeInvitation(invitation.id)

      expect(result).toBe(true)
      expect(getInvitation(invitation.token)).toBeNull()
    })

    it('should return false for unknown id', () => {
      expect(revokeInvitation('inv_unknown')).toBe(false)
    })
  })

  describe('logActivity / getWorkspaceActivity', () => {
    it('should return activities newest first', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      // Spin so each activity gets a distinct millisecond timestamp
      const spin = () => {
        const before = Date.now()
        while (Date.now() === before) { /* spin */ }
      }

      spin()
      logActivity({
        workspaceId: workspace.id,
        userId: 'user-1',
        userName: 'Alice',
        action: 'first',
        details: 'First',
        entityType: 'task',
        entityId: 'task-1',
      })

      spin()
      logActivity({
        workspaceId: workspace.id,
        userId: 'user-1',
        userName: 'Alice',
        action: 'second',
        details: 'Second',
        entityType: 'task',
        entityId: 'task-2',
      })

      const activity = getWorkspaceActivity(workspace.id)
      expect(activity.map(a => a.action)).toEqual(['second', 'first', 'created_workspace'])
    })

    it('should respect the limit parameter', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      for (let i = 0; i < 5; i++) {
        logActivity({
          workspaceId: workspace.id,
          userId: 'user-1',
          userName: 'Alice',
          action: `action-${i}`,
          details: `Activity ${i}`,
          entityType: 'task',
          entityId: `task-${i}`,
        })
      }

      expect(getWorkspaceActivity(workspace.id, 2)).toHaveLength(2)
    })

    it('should trim to the 1000 most recent per workspace', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const other = createWorkspace('Design', 'user-2', 'Bob', 'bob@example.com')

      // 1001 activities for workspace (creation + 1000 logged)
      for (let i = 0; i < 1000; i++) {
        logActivity({
          workspaceId: workspace.id,
          userId: 'user-1',
          userName: 'Alice',
          action: `action-${i}`,
          details: `Activity ${i}`,
          entityType: 'task',
          entityId: `task-${i}`,
        })
      }
      logActivity({
        workspaceId: other.id,
        userId: 'user-2',
        userName: 'Bob',
        action: 'other',
        details: 'Other workspace',
        entityType: 'task',
        entityId: 'task-x',
      })

      const activity = getWorkspaceActivity(workspace.id, 2000)
      // Only the 1000 most recent survive (creation + 1000 logged = 1001)
      expect(activity).toHaveLength(1000)
      // Other workspace's activity is untouched
      expect(getWorkspaceActivity(other.id)).toHaveLength(2)
    })
  })

  describe('addComment', () => {
    it('should add a comment and extract mentions', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      const comment = addComment('task-1', workspace.id, 'user-1', 'Alice', 'Hey @bob, can you review?')

      expect(comment).toBeDefined()
      expect(comment.id).toMatch(/^cmt_/)
      expect(comment.taskId).toBe('task-1')
      expect(comment.workspaceId).toBe(workspace.id)
      expect(comment.content).toBe('Hey @bob, can you review?')
      expect(comment.mentions).toEqual(['bob'])
      expect(comment.createdAt).toBeDefined()
    })

    it('should extract multiple mentions', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      const comment = addComment('task-1', workspace.id, 'user-1', 'Alice', '@bob and @carol please')

      expect(comment.mentions).toEqual(['bob', 'carol'])
    })

    it('should log comment activity', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addComment('task-1', workspace.id, 'user-1', 'Alice', 'Nice work')

      const activity = getWorkspaceActivity(workspace.id)
      expect(activity.find(a => a.action === 'comment_added')).toBeDefined()
    })
  })

  describe('getTaskComments', () => {
    it('should return comments for the task oldest first', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      addComment('task-1', workspace.id, 'user-1', 'Alice', 'First')
      const before = Date.now()
      while (Date.now() === before) { /* spin */ }
      addComment('task-1', workspace.id, 'user-2', 'Bob', 'Second')
      addComment('task-2', workspace.id, 'user-1', 'Alice', 'Other task')

      const comments = getTaskComments('task-1')

      expect(comments).toHaveLength(2)
      expect(comments[0].content).toBe('First')
      expect(comments[1].content).toBe('Second')
    })
  })

  describe('updateComment', () => {
    it('should update content and mentions', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const comment = addComment('task-1', workspace.id, 'user-1', 'Alice', 'Original')

      const updated = updateComment(comment.id, 'Updated @bob', 'user-1')

      expect(updated).toBeDefined()
      expect(updated!.content).toBe('Updated @bob')
      expect(updated!.mentions).toEqual(['bob'])
      expect(updated!.updatedAt).toBeDefined()
    })

    it('should return null when comment not found', () => {
      createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(updateComment('cmt_unknown', 'Nope', 'user-1')).toBeNull()
    })

    it('should return null when user is not the author', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const comment = addComment('task-1', workspace.id, 'user-1', 'Alice', 'Original')

      expect(updateComment(comment.id, 'Hijack', 'user-2')).toBeNull()
    })
  })

  describe('deleteComment', () => {
    it('should remove the comment', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const comment = addComment('task-1', workspace.id, 'user-1', 'Alice', 'Original')

      const result = deleteComment(comment.id, 'user-1')

      expect(result).toBe(true)
      expect(getTaskComments('task-1')).toEqual([])
    })

    it('should return false when user is not the author', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      const comment = addComment('task-1', workspace.id, 'user-1', 'Alice', 'Original')

      expect(deleteComment(comment.id, 'user-2')).toBe(false)
      expect(getTaskComments('task-1')).toHaveLength(1)
    })

    it('should return false when comment not found', () => {
      createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(deleteComment('cmt_unknown', 'user-1')).toBe(false)
    })
  })

  describe('utility functions', () => {
    it('getUserRole returns member role or null', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')

      expect(getUserRole(workspace.id, 'user-1')).toBe('owner')
      expect(getUserRole(workspace.id, 'user-unknown')).toBeNull()
    })

    it('canUserManageWorkspace allows owner and admin only', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob', 'admin')
      addMember(workspace.id, 'user-3', 'carol@example.com', 'Carol', 'member')

      expect(canUserManageWorkspace(workspace.id, 'user-1')).toBe(true)
      expect(canUserManageWorkspace(workspace.id, 'user-2')).toBe(true)
      expect(canUserManageWorkspace(workspace.id, 'user-3')).toBe(false)
      expect(canUserManageWorkspace(workspace.id, 'user-unknown')).toBe(false)
    })

    it('canUserInvite allows owner/admin, or members when invites enabled', () => {
      const workspace = createWorkspace('Engineering', 'user-1', 'Alice', 'alice@example.com')
      addMember(workspace.id, 'user-2', 'bob@example.com', 'Bob', 'member')

      expect(canUserInvite(workspace.id, 'user-1')).toBe(true)
      expect(canUserInvite(workspace.id, 'user-2')).toBe(true) // default allows member invites
      expect(canUserInvite(workspace.id, 'user-unknown')).toBe(false)

      // Disable member invites
      updateWorkspace(workspace.id, {
        settings: { ...workspace.settings, allowMemberInvites: false },
      })

      expect(canUserInvite(workspace.id, 'user-1')).toBe(true)
      expect(canUserInvite(workspace.id, 'user-2')).toBe(false)
    })
  })
})
