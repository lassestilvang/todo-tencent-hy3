import { TaskDetail } from "@/components/task-detail"
import { getTask } from "@/lib/tasks"
import { notFound } from "next/navigation"

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const task = getTask(id)

  if (!task) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <TaskDetail taskId={id} onUpdate={() => {}} />
    </div>
  )
}
