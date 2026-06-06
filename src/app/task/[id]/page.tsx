import type { Metadata } from 'next'
import { TaskDetail } from '@/components/task-detail'
import { getTask } from '@/lib/tasks'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const task = getTask(id)
  if (!task) return {}
  return {
    title: `${task.name} - TaskFlow`,
    description: task.description || `View task: ${task.name}`,
  }
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const task = getTask(id)

  if (!task) notFound()

  return (
    <div className="mx-auto max-w-4xl">
      <TaskDetail task={task} />
    </div>
  )
}
