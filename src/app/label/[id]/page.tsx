import { getLabels } from "@/lib/tasks"
import { TaskList } from "@/components/task-list"

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const labels = getLabels()
  const label = labels.find(l => l.id === id)
  const title = label ? `${label.icon} ${label.name}` : 'Label'

  return <TaskList title={title} />
}
