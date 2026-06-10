import type { Metadata } from 'next'
import { TaskList } from '@/components/task-list'
import { getLists } from '@/lib/tasks'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const lists = getLists()
  const list = lists.find((l) => l.id === id)
  if (!list) return {}
  return {
    title: `${list.emoji} ${list.name} - TaskFlow`,
    description: `View tasks in ${list.name}`,
  }
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ completed?: string }>
}) {
  const [{ id }, { completed }] = await Promise.all([params, searchParams])
  const lists = getLists()
  const list = lists.find((l) => l.id === id)
  if (!list) notFound()

  return (
    <TaskList
      listId={id}
      title={`${list.emoji} ${list.name}`}
      showCompleted={completed !== 'false'}
    />
  )
}
