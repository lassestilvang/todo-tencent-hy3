import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

export function parseTimeToMinutes(time: string): number {
  const [hrs, mins] = time.split(':').map(Number)
  return hrs * 60 + mins
}

export function formatDate(date: string | Date): string {
  return new Date(date).toISOString().split('T')[0]
}
