import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatTime(minutes: number): string {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

export function formatDate(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

export function formatDisplayDate(date: string | Date | null): string {
  if (!date) return 'Not set'
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'Invalid date'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(d)
  target.setHours(0, 0, 0, 0)

  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'

  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'Invalid date'
  return d.toLocaleString()
}

/** Compare date-only strings (YYYY-MM-DD) against today at midnight. */
export function isDateBeforeToday(date: string | null | undefined): boolean {
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  if (isNaN(target.getTime())) return false
  target.setHours(0, 0, 0, 0)
  return target < today
}

export function isOverdue(
  date: string | null | undefined,
  deadline: string | null | undefined,
  completed: boolean
): boolean {
  if (completed) return false
  return isDateBeforeToday(deadline) || isDateBeforeToday(date)
}
