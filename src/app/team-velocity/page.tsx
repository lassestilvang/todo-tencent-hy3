import { Suspense } from 'react'
import { TeamVelocityDashboard } from '@/components/team-velocity-dashboard'
import { getAllTaskLogs } from '@/lib/tasks-client'
import { getTasks, getLists } from '@/lib/tasks-client'
import { ErrorBoundary } from '@/components/error-boundary'
import type { Task, TaskLog, List } from '@/types'

async function fetchVelocityData() {
  const [tasks, logs, lists] = await Promise.all([
    getTasks({ view: 'all' }).catch(() => [] as Task[]),
    getAllTaskLogs().catch(() => [] as TaskLog[]),
    getLists().catch(() => [] as List[]),
  ])
  return { tasks, logs, lists }
}

export const metadata = {
  title: 'Team Velocity | TaskFlow',
  description: 'Productivity analytics and burndown charts for your team',
}

export default async function TeamVelocityPage() {
  let data: { tasks: Task[]; logs: TaskLog[]; lists: List[] }

  try {
    data = await fetchVelocityData()
  } catch (error) {
    console.error('Failed to fetch velocity data:', error)
    data = { tasks: [], logs: [], lists: [] }
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Velocity Dashboard</h1>
        <p className="text-muted-foreground">
          Track productivity metrics, burndown charts, and team performance over time.
        </p>
      </div>

      <ErrorBoundary name="Velocity Dashboard">
        <Suspense fallback={<div className="text-center py-8">Loading dashboard...</div>}>
          <TeamVelocityDashboard
            tasks={data.tasks}
            logs={data.logs}
            lists={data.lists}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
