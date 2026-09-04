'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { rankTasksByQuery } from '@/lib/ai/semantic-filter'
import { formatDisplayDate } from '@/lib/utils'
import { TaskCheckbox } from '@/components/task-checkbox'
import type { Task } from '@/types'

/**
 * Semantic ("AI") search results: tasks ranked
 * by relevance to the query rather than substring
 * match, with the relevance score shown.
 */
export function SemanticSearchResults({
  tasks,
  query,
  threshold,
}: {
  tasks: Task[]
  query: string
  threshold?: number
}) {
  const results = useMemo(
    () =>
      query.length >= 2
        ? rankTasksByQuery(tasks, query, { threshold })
        : [],
    [tasks, query, threshold],
  )

  if (query.length < 2) {
    return null
  }

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No tasks match &quot;{query}&quot; semantically
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex items-center gap-1.5 pb-2 text-sm">
        <Sparkles className="h-3.5 w-3.5" />
        {results.length} task
        {results.length === 1 ? '' : 's'} ranked by relevance
      </p>
      {results.map(({ task, score }) => (
        <div
          key={task.id}
          className="hover:bg-accent flex items-center gap-3 rounded-lg p-3"
        >
          <TaskCheckbox
            taskId={task.id}
            checked={task.completed}
            taskName={task.name}
          />
          <Link href={`/task/${task.id}`} className="flex min-w-0 flex-1">
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
          <span
            className="text-muted-foreground shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums"
            title={`${Math.round(score * 100)}% relevance`}
          >
            {Math.round(score * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}
