import { TaskList } from '@/components/task-list'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'All Tasks - TaskFlow',
  description: 'View and manage all your tasks',
}

export default async function AllPage({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string }>
}) {
  const { completed } = await searchParams
  return (
    <TaskList
      view="all"
      title="All Tasks"
      showCompleted={completed !== 'false'}
    />
  )
}
