'use client'

import { useEffect, useState, Suspense } from 'react'
import { ProductivityTrends } from '@/components/analytics/productivity-trends'
import { FocusAnalytics } from '@/components/analytics/focus-analytics'
import { AIRecommendations } from '@/components/ai/ai-recommendations'
import { SmartScheduler } from '@/components/ai/smart-scheduler'
import { ErrorBoundary } from '@/components/error-boundary'
import { getTasks, getAllTaskLogs } from '@/lib/tasks-client'
import { getLists } from '@/lib/tasks-client'
import type { Task, List, TaskLog } from '@/types'

function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-2">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}

interface AnalyticsDashboardContentProps {
  tasks?: Task[]
  lists?: List[]
  logs?: TaskLog[]
}

export function AnalyticsDashboardContent({ tasks: tasksProp, lists: listsProp, logs: logsProp }: AnalyticsDashboardContentProps) {
  const [tasks, setTasks] = useState<Task[]>(tasksProp || [])
  const [lists, setLists] = useState<List[]>(listsProp || [])
  const [logs, setLogs] = useState<TaskLog[]>(logsProp || [])
  const [loading, setLoading] = useState(!tasksProp || !listsProp || !logsProp)

  // Use initial props directly - no sync setState in effect needed
  useEffect(() => {
    if (!tasksProp && !listsProp && !logsProp && loading) {
      async function fetchData() {
        try {
          const [fetchedTasks, fetchedLists, fetchedLogs] = await Promise.all([
            getTasks({ view: 'all' }).catch(() => [] as Task[]),
            getLists().catch(() => [] as List[]),
            getAllTaskLogs().catch(() => [] as TaskLog[]),
          ])
          setTasks(fetchedTasks)
          setLists(fetchedLists)
          setLogs(fetchedLogs)
        } catch (error) {
          console.error('Failed to fetch analytics data:', error)
        } finally {
          setLoading(false)
        }
      }

      fetchData()
    }
  }, [tasksProp, listsProp, logsProp, loading])

  if (loading) {
    return <LoadingSpinner label="Loading analytics..." />
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">AI-powered productivity insights and scheduling</p>
        </div>
      </div>

      {/* Each widget is isolated so one failing
          section cannot take down the dashboard. */}
      {/* Productivity Trends */}
      <ErrorBoundary name="Productivity Trends">
        <Suspense fallback={<LoadingSpinner label="Loading trends..." />}>
          <ProductivityTrends tasks={tasks} logs={logs} timeRange="month" />
        </Suspense>
      </ErrorBoundary>

      {/* Focus Sessions */}
      <ErrorBoundary name="Focus Sessions">
        <Suspense fallback={<LoadingSpinner label="Loading focus analytics..." />}>
          <FocusAnalytics />
        </Suspense>
      </ErrorBoundary>

      {/* AI Recommendations */}
      <ErrorBoundary name="AI Recommendations">
        <Suspense fallback={<LoadingSpinner label="Loading recommendations..." />}>
          <AIRecommendations tasks={tasks} lists={lists} logs={logs} maxRecommendations={5} />
        </Suspense>
      </ErrorBoundary>

      {/* Smart Scheduler */}
      <ErrorBoundary name="Smart Scheduler">
        <Suspense fallback={<LoadingSpinner label="Loading scheduler..." />}>
          <SmartScheduler tasks={tasks} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export function AnalyticsDashboard() {
  return <AnalyticsDashboardContent />
}

export default AnalyticsDashboard