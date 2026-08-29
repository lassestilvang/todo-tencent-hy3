import { getTasks, getLists } from '@/lib/tasks'
import { TodayClient } from './today-client'
import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Today's Tasks - TaskFlow",
  description: 'View and manage your tasks for today',
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string }>
}) {
  const { completed } = await searchParams
  const [tasks, lists] = await Promise.all([
    getTasks({ view: 'today', completed: completed !== 'false' ? undefined : false }),
    getLists(),
  ])

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <TodayClient tasks={tasks} lists={lists} showCompleted={completed !== 'false'} />
    </Suspense>
  )
}