/**
 * Utility helpers for Shared Focus Rooms.
 */

/**
 * Generate a short, human-readable invite code from a room id.
 * The room id is `room_<base64>`, so we strip the prefix and
 * take the first 6 characters of the base64 suffix, uppercased.
 */
export function generateRoomInviteCode(roomId: string): string {
  const suffix = roomId.replace(/^room_/, '')
  return suffix.slice(0, 6).toUpperCase()
}

/**
 * Resolve a room id from an invite code.
 * The code is the first 6 chars of the base64 suffix, uppercased.
 * Since base64url is case-sensitive, we match case-insensitively
 * and return the canonical room id if found.
 */
export function roomIdFromInviteCode(code: string): string {
  return `room_${code.toLowerCase()}`
}
