import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export function TaskSkeleton() {
  const skeletonIds = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5']
  return (
    <div className="space-y-3 p-4">
      {skeletonIds.map((id) => (
        <div key={id} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
