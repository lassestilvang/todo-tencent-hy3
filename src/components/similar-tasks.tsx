'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Clock, CheckSquare, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/lib/tasks-client'
import { semanticSimilarity } from '@/lib/ai/embeddings'
import type { Task } from '@/types'
import { formatDateTime } from '@/lib/utils'

interface SimilarTasksProps {
  currentTask: Task
}

/**
 * Displays semantically similar past tasks to provide context
 * and help users understand how they've approached similar work before.
 *
 * Uses hash-based embeddings to find similarity between task names,
 * enabling a lightweight but effective "find similar tasks" feature
 * without requiring a remote AI API.
 */
export function SimilarTasks({ currentTask }: SimilarTasksProps) {
  const { data: allTasks, error } = useTasks({ view: 'all' })
  const [expanded, setExpanded] = useState(false)

  const similarTasks = useMemo(() => {
    if (!allTasks || !currentTask.name) return []

    // Only look at completed tasks that aren't the current task
    const candidates = allTasks.filter(
      t =>
        t.completed &&
        t.id !== currentTask.id &&
        t.name
    )

    if (candidates.length === 0) return []

    // Calculate semantic similarity scores using hash-based embeddings
    const scored = candidates.map(task => ({
      task,
      similarity: semanticSimilarity(
        currentTask.name + (currentTask.description || ''),
        task.name + (task.description || '')
      ),
    }))

    // Only show tasks with meaningful similarity (threshold: 0.35)
    return scored
      .filter(s => s.similarity > 0.35)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
  }, [allTasks, currentTask])

  if (error) {
    return null
  }

  if (similarTasks.length === 0) {
    return null
  }

  return (
    <Card className="glass-effect">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase text-muted-foreground">
            Similar Past Tasks
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 text-xs"
          >
            {expanded ? 'Show less' : 'Show all'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          These tasks have similar names or descriptions. Reviewing them
          can help you understand how you approached this type of work before.
        </p>
        <div className="space-y-3">
          {(expanded ? similarTasks : similarTasks.slice(0, 2)).map(({ task, similarity }) => (
            <Link
              key={task.id}
              href={`/task/${task.id}`}
              className="block"
            >
              <div className="border-border/20 hover:bg-accent/30 rounded-lg border p-3 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5 text-green-500/70" />
                      <span className="font-medium text-sm">{task.name}</span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 ml-5">
                        {task.description}
                      </p>
                    )}
                    <div className="ml-5 mt-1.5 flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{task.estimate || '-'} min</span>
                      </div>
                      {task.completed_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Completed {formatDateTime(task.completed_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {Math.round(similarity * 100)}% match
                    </Badge>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
