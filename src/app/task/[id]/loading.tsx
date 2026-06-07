import { TaskDetailSkeleton } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <TaskDetailSkeleton />
    </div>
  )
}
