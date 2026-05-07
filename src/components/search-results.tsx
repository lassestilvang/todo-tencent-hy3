import Link from 'next/link'
import { searchTasks } from '@/lib/tasks'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDisplayDate } from '@/lib/utils'

export async function SearchResults({ query }: { query: string }) {
  if (!query || query.length < 2) {
    return null
  }

  const results = searchTasks(query)

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No tasks found matching &quot;{query}&quot;
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {results.map((task) => (
        <Link
          key={task.id}
          href={`/task/${task.id}`}
          className="hover:bg-accent flex items-center gap-3 rounded-lg p-3"
        >
          <Checkbox checked={task.completed} />
          <div className="min-w-0 flex-1">
            <p
              className={`truncate ${task.completed ? 'line-through opacity-60' : ''}`}
            >
              {task.name}
            </p>
            {task.date && (
              <p className="text-muted-foreground text-xs">
                {formatDisplayDate(task.date)}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
