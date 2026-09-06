/**
 * Shared Focus Rooms — collaborative deep-work sessions.
 *
 * When two or more people are in the same workspace they can open a
 * shared focus room: a timer session whose state (running, paused,
 * time-remaining, mode) is broadcast in real time to every member.
 *
 * The registry is in-memory, mirroring the design of the presence
 * and activity-stream modules — the deployment is single-process, so
 * module state is the right scope for the session store.
 *
 * Rooms are ephemeral: they are deleted when the last member leaves.
 */

import { randomBytes } from 'crypto'
import { publishActivity } from '@/lib/collaboration/activity-stream'
import type { WorkspaceActivity } from '@/lib/workspaces'

export type RoomTimerMode = 'pomodoro' | 'shortBreak' | 'longBreak'

export interface RoomMember {
  clientId: string
  name: string
  joinedAt: number
  /** Whether this member is the session leader (started the timer). */
  isLeader: boolean
}

export interface RoomSessionState {
  isRunning: boolean
  mode: RoomTimerMode
  /** Seconds remaining on the current timer. */
  timeRemaining: number
  /** Epoch ms when the current timer segment started. */
  startedAt: number | null
  /** Total completed pomodoro sessions in this room. */
  completedSessions: number
  /** Name of the member currently running the timer. */
  leaderClientId: string | null
}

export interface SharedFocusRoom {
  id: string
  workspaceId: string
  name: string
  members: RoomMember[]
  session: RoomSessionState
  createdAt: number
  updatedAt: number
}

function generateRoomId(): string {
  return `room_${randomBytes(8).toString('base64url')}`
}

const rooms = new Map<string, SharedFocusRoom>()

/** Default session state for a new room. */
function defaultSession(): RoomSessionState {
  return {
    isRunning: false,
    mode: 'pomodoro',
    timeRemaining: 25 * 60,
    startedAt: null,
    completedSessions: 0,
    leaderClientId: null,
  }
}

/**
 * Create a focus room in a workspace and add the creator as the
 * first member and initial leader.
 */
export function createRoom(
  workspaceId: string,
  roomName: string,
  clientId: string,
  memberName: string
): SharedFocusRoom {
  const room: SharedFocusRoom = {
    id: generateRoomId(),
    name: roomName,
    workspaceId,
    members: [
      {
        clientId,
        name: memberName,
        joinedAt: Date.now(),
        isLeader: true,
      },
    ],
    session: defaultSession(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  rooms.set(room.id, room)
  broadcastRoomEvent(room)
  return room
}

/** Look up a room by id, or null if it doesn't exist. */
export function getRoom(roomId: string): SharedFocusRoom | null {
  return rooms.get(roomId) ?? null
}

/** All rooms in a workspace that still have at least one member. */
export function getRooms(workspaceId: string): SharedFocusRoom[] {
  return [...rooms.values()].filter(
    (room) => room.workspaceId === workspaceId && room.members.length > 0
  )
}

/**
 * Join an existing room. The joining member is not a leader.
 * Returns the updated room, or null if the room doesn't exist.
 */
export function joinRoom(
  roomId: string,
  clientId: string,
  memberName: string
): SharedFocusRoom | null {
  const room = rooms.get(roomId)
  if (!room) return null

  // Don't add duplicate memberships
  if (room.members.some((m) => m.clientId === clientId)) return room

  room.members.push({
    clientId,
    name: memberName,
    joinedAt: Date.now(),
    isLeader: false,
  })
  room.updatedAt = Date.now()

  broadcastRoomEvent(room)
  return room
}

/**
 * Leave a room. If the last member leaves, the room is deleted.
 * Returns true if the room was deleted, false if other members remain.
 */
export function leaveRoom(roomId: string, clientId: string): boolean {
  const room = rooms.get(roomId)
  if (!room) return false

  room.members = room.members.filter((m) => m.clientId !== clientId)
  room.updatedAt = Date.now()

  // Clean up leadership if the leader leaves
  if (!room.members.some((m) => m.isLeader) && room.members.length > 0) {
    room.members[0].isLeader = true
  }

  const wasDeleted = room.members.length === 0
  if (wasDeleted) {
    rooms.delete(roomId)
  } else {
    broadcastRoomEvent(room)
  }

  return wasDeleted
}

/**
 * Update the shared session state (start/pause/complete).
 * The member identified by `clientId` becomes the leader.
 */
export function updateSession(
  roomId: string,
  clientId: string,
  updates: Partial<Omit<RoomSessionState, 'leaderClientId'>>
): SharedFocusRoom | null {
  const room = rooms.get(roomId)
  if (!room) return null

  const member = room.members.find((m) => m.clientId === clientId)
  if (!member) return null

  // The member updating the session becomes the leader
  for (const m of room.members) {
    m.isLeader = m.clientId === clientId
  }

  room.session = {
    ...room.session,
    ...updates,
    leaderClientId: clientId,
  }
  room.updatedAt = Date.now()

  broadcastSessionState(room)
  return room
}

/**
 * Advance the timer by one second for a running session.
 * Only the leader can tick the timer.
 */
export function tickSession(roomId: string, clientId: string): SharedFocusRoom | null {
  const room = rooms.get(roomId)
  if (!room || !room.session.isRunning) return null

  const isLeader =
    room.session.leaderClientId === clientId ||
    room.members.find((m) => m.isLeader)?.clientId === clientId

  if (!isLeader) return null

  if (room.session.startedAt === null) {
    room.session.startedAt = Date.now()
  }

  const elapsed = Math.floor((Date.now() - room.session.startedAt) / 1000)
  const duration = getDurationForMode(room.session.mode)
  room.session.timeRemaining = Math.max(0, duration - elapsed)

  if (room.session.timeRemaining <= 0) {
    room.session.isRunning = false
    room.session.startedAt = null
    room.session.completedSessions += 1
    broadcastSessionComplete(room)
    return room
  }

  return room
}

/** Original duration in seconds for each timer mode. */
function getDurationForMode(mode: RoomTimerMode): number {
  switch (mode) {
    case 'pomodoro':
      return 25 * 60
    case 'shortBreak':
      return 5 * 60
    case 'longBreak':
      return 15 * 60
    default:
      return 25 * 60
  }
}

/** Reset the timer back to the default duration for the current mode. */
export function resetSession(
  roomId: string,
  clientId: string
): SharedFocusRoom | null {
  const room = rooms.get(roomId)
  if (!room) return null

  for (const m of room.members) {
    m.isLeader = m.clientId === clientId
  }

  room.session = {
    ...room.session,
    isRunning: false,
    timeRemaining: getDurationForMode(room.session.mode),
    startedAt: null,
    leaderClientId: clientId,
  }
  room.updatedAt = Date.now()

  broadcastSessionState(room)
  return room
}

/** Complete the current segment and cycle to the next mode. */
export function completeSegment(
  roomId: string,
  clientId: string
): SharedFocusRoom | null {
  const room = rooms.get(roomId)
  if (!room) return null

  for (const m of room.members) {
    m.isLeader = m.clientId === clientId
  }

  const nextMode: RoomTimerMode =
    room.session.mode === 'pomodoro'
      ? room.members.length > 1
        ? 'shortBreak'
        : 'shortBreak'
      : 'pomodoro'

  room.session = {
    ...room.session,
    isRunning: false,
    mode: nextMode,
    timeRemaining: getDurationForMode(nextMode),
    startedAt: null,
    completedSessions: room.session.completedSessions + 1,
    leaderClientId: clientId,
  }
  room.updatedAt = Date.now()

  broadcastSessionComplete(room)
  return room
}

/**
 * Publish a lightweight "room state changed" event through the
 * existing SSE activity stream. Clients listening on the workspace
 * channel receive this and can fetch the full room state.
 */
function broadcastRoomEvent(room: SharedFocusRoom): void {
  const event: WorkspaceActivity = {
    id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: room.workspaceId,
    userId: room.members.find((m) => m.isLeader)?.clientId ?? '',
    userName: room.members.find((m) => m.isLeader)?.name ?? 'Someone',
    action: 'room_updated',
    details: JSON.stringify({ roomId: room.id, name: room.name }),
    entityType: 'workspace',
    entityId: room.id,
    createdAt: Date.now(),
  }
  publishActivity(event)
}

/**
 * Publish a session-state event (start/pause/reset).
 * Distinct from room membership events so clients can decide
 * whether to update their local timer.
 */
function broadcastSessionState(room: SharedFocusRoom): void {
  const leader = room.members.find((m) => m.isLeader)
  const event: WorkspaceActivity = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: room.workspaceId,
    userId: leader?.clientId ?? '',
    userName: leader?.name ?? 'Someone',
    action: 'room_session_state',
    details: JSON.stringify({
      roomId: room.id,
      isRunning: room.session.isRunning,
      mode: room.session.mode,
      timeRemaining: room.session.timeRemaining,
      startedAt: room.session.startedAt,
      completedSessions: room.session.completedSessions,
      leaderClientId: room.session.leaderClientId,
    }),
    entityType: 'workspace',
    entityId: room.id,
    createdAt: Date.now(),
  }
  publishActivity(event)
}

/**
 * Publish a "session segment complete" event with celebration context.
 */
function broadcastSessionComplete(room: SharedFocusRoom): void {
  const leader = room.members.find((m) => m.isLeader)
  const event: WorkspaceActivity = {
    id: `done_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: room.workspaceId,
    userId: leader?.clientId ?? '',
    userName: leader?.name ?? 'Someone',
    action: 'room_session_complete',
    details: JSON.stringify({
      roomId: room.id,
      mode: room.session.mode,
      completedSessions: room.session.completedSessions,
      modeCompleted: true,
    }),
    entityType: 'workspace',
    entityId: room.id,
    createdAt: Date.now(),
  }
  publishActivity(event)
}

/** Test helper: drop all rooms. */
export function resetRoomsForTesting(): void {
  rooms.clear()
}
