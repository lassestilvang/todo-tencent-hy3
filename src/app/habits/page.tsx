import { Suspense } from 'react'
import { HabitLoopBuilder } from '@/components/habit-loop-builder'
import { ErrorBoundary } from '@/components/error-boundary'
import type { Habit, HabitExecution } from '@/lib/habits'

async function fetchHabits() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/habits?stats=true`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error('Failed to fetch habits')
  return res.json()
}

async function fetchExecutions() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/habits/executions`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  return res.json()
}

export default async function HabitsPage() {
  let habits: Habit[] = []
  let executions: HabitExecution[] = []

  try {
    habits = await fetchHabits()
  } catch (error) {
    console.error('Failed to fetch habits:', error)
  }

  try {
    executions = await fetchExecutions()
  } catch (error) {
    console.error('Failed to fetch executions:', error)
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Habit Loop Builder</h1>
        <p className="text-muted-foreground">
          Build, track, and optimize habits using the Cue → Craving → Response → Reward framework
        </p>
      </div>

      <ErrorBoundary name="Habit Loop Builder">
        <Suspense fallback={<div className="text-center py-8">Loading habits...</div>}>
          <HabitLoopBuilder
            habits={habits}
            executions={executions}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
