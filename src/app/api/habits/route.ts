import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Habit, HabitExecution } from '@/lib/habits'
import { calculateHabitStats } from '@/lib/habits'
import { habitStore, executionStore } from '@/lib/habit-store'

const habitSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  cue: z.object({
    type: z.enum(['time', 'location', 'emotion', 'preceding-action', 'other-person', 'environmental']),
    value: z.string(),
  }),
  craving: z.string(),
  response: z.string(),
  reward: z.object({
    type: z.enum(['tangible', 'social', 'achievement', 'status', 'knowledge', 'peace-of-mind']),
    value: z.string(),
  }),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  schedule: z.array(z.number()).optional(),
  taskIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  id: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const includeStats = searchParams.get('stats') === 'true'
  const activeOnly = searchParams.get('active') !== 'false'

  let habits = Array.from(habitStore.values())

  if (activeOnly) {
    habits = habits.filter((h) => h.active !== false)
  }

  if (includeStats) {
    const withStats = habits.map((habit) => {
      const executions = executionStore.get(habit.id) || []
      return calculateHabitStats(habit, executions)
    })
    return NextResponse.json(withStats)
  }

  return NextResponse.json(habits)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = habitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const {
      id = `habit-${Date.now()}`,
      createdAt = new Date().toISOString(),
      updatedAt = new Date().toISOString(),
      active = true,
      ...rest
    } = parsed.data

    const habit: Habit = {
      id,
      createdAt,
      updatedAt,
      active,
      ...rest,
    }

    habitStore.set(id, habit)
    return NextResponse.json(habit, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (id && habitStore.has(id)) {
      const existing = habitStore.get(id)!
      const updated: Habit = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      habitStore.set(id, updated)
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id && habitStore.has(id)) {
      habitStore.delete(id)
      executionStore.delete(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 })
  }
}
