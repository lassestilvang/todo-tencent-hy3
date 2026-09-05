'use client'

import { useMemo } from 'react'
import { Sparkles, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTasks } from '@/lib/tasks-client'
import { semanticSimilarity } from '@/lib/ai/embeddings'
import type { Task } from '@/types'
import { useState } from 'react'
import { toast } from 'sonner'

interface TaskTemplateSuggestionsProps {
  /** The current task name being typed — used to find similar past tasks */
  currentTaskName: string
  listId?: string
  /** Callback when a template is used */
  onUseTemplate?: (task: Task) => void
}

/**
 * Suggests task templates based on semantic similarity to past tasks.
 *
 * Uses the hash-based embeddings system to find previously created tasks
 * that are semantically similar to the task being typed. This helps users
 * discover patterns and reuse past work efficiently.
 */
export function TaskTemplateSuggestions({
  currentTaskName,
  listId,
  onUseTemplate,
}: TaskTemplateSuggestionsProps) {
  const { data: allTasks } = useTasks({ view: 'all' })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Find semantically similar past tasks
  const suggestions = useMemo(() => {
    if (!currentTaskName || !currentTaskName.trim() || !allTasks) return []

    const completedTasks = allTasks.filter(
      (t) => t.completed && t.name.toLowerCase() !== currentTaskName.toLowerCase()
    )

    if (completedTasks.length === 0) return []

    // Calculate similarity scores
    const scored = completedTasks.map((task) => ({
      task,
      similarity: semanticSimilarity(currentTaskName, task.name),
    }))

    // Only show tasks with meaningful similarity (threshold: 0.3)
    return scored
      .filter((s) => s.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
  }, [currentTaskName, allTasks])

  if (suggestions.length === 0) return null

  const handleUseTemplate = (task: Task) => {
    onUseTemplate?.(task)
    setCopiedId(task.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success(`Template from "${task.name}" applied`)
  }

  const handleCopy = (task: Task) => {
    navigator.clipboard.writeText(task.name)
    setCopiedId(task.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Name copied to clipboard')
  }

  return (
    <Card className="glass-effect mt-3">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Templates from Similar Past Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map(({ task, similarity }) => (
          <div
            key={task.id}
            className="group flex items-center justify-between rounded-lg border border-border/30 p-2.5 transition-colors hover:bg-accent/30"
          >
            <div className="flex-1">
              <div className="text-sm font-medium">{task.name}</div>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {task.description}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor:
                      Math.round(similarity * 100) < 50
                        ? 'hsl(var(--success))'
                        : undefined,
                  }}
                >
                  {Math.round(similarity * 100)}% match
                </Badge>
                {task.priority !== 'none' && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {task.priority}
                  </Badge>
                )}
                {task.estimate && (
                  <span className="text-xs text-muted-foreground">
                    ~{task.estimate} min
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleCopy(task)}
                title="Copy name"
              >
                {copiedId === task.id ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleUseTemplate(task)}
                title="Use as template"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
