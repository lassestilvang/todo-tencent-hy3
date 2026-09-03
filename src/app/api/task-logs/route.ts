import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { taskLogs } from '@/lib/db/schema'

export async function GET() {
  try {
    const db = getDb()
    const logs = db.select().from(taskLogs).all()

    return NextResponse.json(
      logs.map(log => ({
        id: log.id,
        task_id: log.taskId,
        action: log.action,
        details: log.details,
        created_at: log.createdAt,
      }))
    )
  } catch (error) {
    console.error('Failed to fetch task logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch task logs' },
      { status: 500 }
    )
  }
}