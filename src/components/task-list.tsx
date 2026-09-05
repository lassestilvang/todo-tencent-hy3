import { getTasks, getLists } from '@/lib/tasks'
import { TaskListView } from '@/components/task-list-view'
import type { Task, List } from '@/types'

interface TaskListProps {
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  listId?: string
  labelId?: string
  priority?: 'high' | 'medium' | 'low' | 'none'
  title: string
  searchQuery?: string
  showCompleted?: boolean
}

export async function TaskList({
  view,
  listId,
  labelId,
  priority,
  title,
  searchQuery,
  showCompleted = true,
}: TaskListProps) {
  const tasks = await getTasks({
    view,
    listId,
    labelId,
    priority,
    completed: showCompleted ? undefined : false,
    search: searchQuery,
  })

  const lists = await getLists()

  return (
    <TaskListView
      tasks={tasks}
      lists={lists}
      title={title}
      showCompleted={showCompleted}
      searchQuery={searchQuery}
      priority={priority}
      listId={listId}
      labelId={labelId}
      view={view}
    />
  )
}
