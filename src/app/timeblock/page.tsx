import type { Metadata } from 'next'
import { TimeBlockView } from '@/components/time-block-view'
import { getTasks } from '@/lib/tasks'

export const metadata: Metadata = {
  title: 'Time Blocking - TaskFlow',
  description: 'Drag-and-drop time blocking with AI-powered scheduling',
}

export default async function TimeBlockPage() {
  const tasks = await getTasks({ view: 'today', completed: undefined })

  return (
    <div className="container mx-auto py-8 px-4">
      <TimeBlockView initialTasks={tasks} />
    </div>
  )
}
