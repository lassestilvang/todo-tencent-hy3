import type { Metadata } from 'next'
import { getLabels } from '@/lib/tasks'
import { TaskList } from '@/components/task-list'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const labels = getLabels()
  const label = labels.find((l) => l.id === id)
  const title = label ? `${label.icon} ${label.name}` : 'Label'
  return {
    title: `${title} - TaskFlow`,
    description: `View tasks with label: ${label?.name || 'label'}`,
  }
}

export default async function LabelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const labels = getLabels()
  const label = labels.find((l) => l.id === id)
  const title = label ? `${label.icon} ${label.name}` : 'Label'

  return <TaskList labelId={id} title={title} />
}
