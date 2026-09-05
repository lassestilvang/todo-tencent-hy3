import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { HabitExecution } from '@/lib/habits'

/**
 * In-memory execution store, shared with the habits route.
 * In a real app, this would be in a database.
 */
import { executionStore } from '@/lib/habit-store'

const executionSchema = z.object({
  habitId: z.string(),
  completedAt: z.string().optional(),
  duration: z.number().optional(),
  satisfaction: z.number().int().min(1).max(5),
  id: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const habitId = searchParams.get('habitId')
  const { searchParams: searchParamsObj } = new URL(request.url)

  // Extract habitId from URL path segments
  const parts = request.nextUrl.pathname.split('/')
  const habitIdFromPath = parts[parts.length - 2] // .../habits/{id}/executions

  let executions: HabitExecution[] = []

  if (habitIdFromPath) {
    executions = executionStore.get(habitIdFromPath) || []
  }

  return NextResponse.json(executions)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = executionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { habitId, completedAt = new Date().toISOString(), duration, satisfaction, id } = parsed.data

    const execution: HabitExecution = {
      id: id || `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      habitId,
      completedAt,
      duration,
      satisfaction,
    }

    const existing = executionStore.get(habitId) || []
    executionStore.set(habitId, [...existing, execution])

    return NextResponse.json(execution, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to record execution' }, { status: 500 })
  }
}
