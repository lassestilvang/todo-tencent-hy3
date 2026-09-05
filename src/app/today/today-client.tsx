'use client'

import { TaskListView } from '@/components/task-list-view'
import { useFaviconProgress } from '@/lib/use-favicon-progress'
import type { Task, List } from '@/types'

interface TodayClientProps {
  tasks: Task[]
  lists: List[]
}

export function TodayClient({ tasks, lists }: TodayClientProps) {
  // Update the browser tab favicon with a progress ring
  // reflecting today's task completion.
  useFaviconProgress()

  return (
    <TaskListView
      tasks={tasks}
      lists={lists}
      title="Today"
      aiWidgets={true}
      view="today"
    />
  )
}
