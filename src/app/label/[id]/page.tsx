import type { Metadata } from 'next'
import { getLabels } from '@/lib/tasks'
import { TaskList } from '@/components/task-list'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const labels = getLabels()
  const label = labels.find((l) => l.id === id)
  if (!label) return {}
  return {
    title: `${label.icon} ${label.name} - TaskFlow`,
    description: `View tasks with label: ${label.name}`,
  }
}

export default async function LabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ completed?: string }>
}) {
  const { id } = await params
  const { completed } = await searchParams
  const labels = getLabels()
  const label = labels.find((l) => l.id === id)
  if (!label) notFound()

  return (
    <TaskList
      labelId={id}
      title={`${label.icon} ${label.name}`}
      showCompleted={completed !== 'false'}
    />
  )
}
