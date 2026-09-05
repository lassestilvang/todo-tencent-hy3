import type { Metadata } from 'next'
import { TaskArcheologyView } from '@/components/task-archeology-view'
import { getTask, getTaskHistory } from '@/lib/tasks'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Task History - TaskFlow',
  description: 'View the full audit trail and change history of a task',
}

export default async function TaskArcheologyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const task = await getTask(id)
  const timeline = getTaskHistory(id)

  if (!task) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <nav className="text-xs text-muted-foreground mb-2">
          <a href={`/task/${task.id}`} className="hover:underline">Tasks</a>
          {' / '}
          <span>Task History</span>
        </nav>
        <h1 className="text-2xl font-bold">Task History</h1>
        <p className="text-sm text-muted-foreground">
          Complete audit trail for "{task.name}"
        </p>
      </div>

      <TaskArcheologyView
        task={task}
        timeline={timeline}
        logCount={timeline.length}
      />
    </div>
  )
}
