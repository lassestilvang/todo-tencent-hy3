import { NextResponse } from 'next/server'
import { processDueReminders } from '@/lib/tasks'

/**
 * Background reminder sweep. The client polls this
 * every minute; each call delivers the reminders
 * whose time has come (and marks them sent, so
 * they are never delivered twice).
 */
export async function GET() {
  try {
    const reminders = processDueReminders()
    return NextResponse.json({ reminders })
  } catch (error) {
    console.error('Reminder processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    )
  }
}
