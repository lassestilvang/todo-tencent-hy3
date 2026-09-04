import { TaskList } from '@/components/task-list'
import { FilterPresets } from '@/components/filter-presets'
import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'All Tasks - TaskFlow',
  description: 'View and manage all your tasks',
}

const VIEWS = ['today', 'next7', 'upcoming', 'all'] as const
const PRIORITIES = ['high', 'medium', 'low', 'none'] as const

export default async function AllPage({
  searchParams,
}: {
  searchParams: Promise<{
    completed?: string
    view?: string
    listId?: string
    labelId?: string
    priority?: string
    search?: string
  }>
}) {
  const { completed, view, listId, labelId, priority, search } =
    await searchParams

  return (
    <>
      <Suspense fallback={null}>
        <FilterPresets />
      </Suspense>
      <TaskList
        view={
          view && (VIEWS as readonly string[]).includes(view)
            ? (view as (typeof VIEWS)[number])
            : 'all'
        }
        listId={listId}
        labelId={labelId}
        priority={
          priority && (PRIORITIES as readonly string[]).includes(priority)
            ? (priority as (typeof PRIORITIES)[number])
            : undefined
        }
        title="All Tasks"
        searchQuery={search}
        showCompleted={completed !== 'false'}
      />
    </>
  )
}
