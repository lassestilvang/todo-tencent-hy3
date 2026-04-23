import Link from "next/link"
import { searchTasks } from "@/lib/tasks"
import { Checkbox } from "@/components/ui/checkbox"

export async function SearchResults({ query }: { query: string }) {
  if (!query || query.length < 2) {
    return null
  }

  const results = searchTasks(query)

  if (results.length === 0) {
    return <p className="text-center py-12 text-muted-foreground">No tasks found matching "{query}"</p>
  }

  return (
    <div className="space-y-1">
      {results.map(task => (
        <Link
          key={task.id}
          href={`/task/${task.id}`}
          className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg"
        >
          <Checkbox checked={task.completed === 1} />
          <div className="flex-1 min-w-0">
            <p className={`truncate ${task.completed ? 'line-through opacity-60' : ''}`}>
              {task.name}
            </p>
            {task.date && (
              <p className="text-xs text-muted-foreground">{new Date(task.date).toLocaleDateString()}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
