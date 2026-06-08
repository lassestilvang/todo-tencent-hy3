import { TaskList } from '@/components/task-list'
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
  return (
    <TaskList
      view="today"
      title="Today"
      showCompleted={completed !== 'false'}
    />
  )
}
