/**
 * Task assignment
 *
 * Pure helpers for assigning tasks to workspace
 * members: who may assign, and what the
 * assignment notification looks like. The
 * server-side delivery lives in `notifier.ts`.
 */
import type {
  Task,
  WorkspaceMember,
  WorkspaceRole,
} from '@/types'

export interface AssignmentNotification {
  title: string
  body: string
  tag: string
  data: {
    taskId: string
    taskName: string
    assigneeId: string
  }
}

/**
 * Who may assign tasks. Viewers can see the
 * workspace but not change anything in it.
 */
export function canAssignTask(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member'
}

/** True when the assignment actually changed. */
export function assignmentChanged(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  return (from ?? null) !== (to ?? null)
}

/**
 * Build the push notification for an assignment.
 * `assignerName` is optional — the server does not
 * always know who triggered the change.
 */
export function buildAssignmentNotification(input: {
  task: Pick<Task, 'id' | 'name'>
  assignee: Pick<WorkspaceMember, 'id' | 'name'>
  assignerName?: string
}): AssignmentNotification {
  const { task, assignee, assignerName } = input

  const who = assignerName ? ` by ${assignerName}` : ''
  const due = task.name

  return {
    title: 'Task assigned to you',
    body: `"${due}" was assigned to you${who}.`,
    tag: `task-assignment-${task.id}`,
    data: {
      taskId: task.id,
      taskName: task.name,
      assigneeId: assignee.id,
    },
  }
}

/**
 * Look up a member by id from a workspace roster.
 * Pure so callers decide where the roster comes from.
 */
export function findMember(
  members: WorkspaceMember[],
  memberId: string | null | undefined
): WorkspaceMember | undefined {
  if (!memberId) return undefined
  return members.find((member) => member.id === memberId)
}
