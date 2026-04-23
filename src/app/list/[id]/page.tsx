import { TaskList } from "@/components/task-list"
import { getLists } from "@/lib/tasks"

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lists = getLists()
  const list = lists.find(l => l.id === id)
  const title = list ? `${list.emoji} ${list.name}` : 'List'

  return <TaskList listId={id} title={title} />
}
