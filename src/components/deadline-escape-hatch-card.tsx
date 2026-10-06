'use client'

import { useState } from 'react'
import { AlertTriangle, GitBranch, Sparkles, Copy, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDateTime } from '@/lib/utils'
import { checkDeadlineEscapeHatch, type DeadlineEscapeHatch } from '@/lib/deadline-escape-hatch'
import type { Task } from '@/types'

interface DeadlineEscapeHatchCardProps {
  task: Task
}

const SUGGESTION_LABELS: Record<DeadlineEscapeHatch['suggestion'], { label: string; icon: React.ReactNode }> = {
  decompose: { label: 'Break Down', icon: <GitBranch className="h-4 w-4" /> },
  template: { label: 'Make Template', icon: <Sparkles className="h-4 w-4" /> },
  renegotiate: { label: 'Renegotiate', icon: <AlertTriangle className="h-4 w-4" /> },
  accept: { label: 'Accept', icon: <Copy className="h-4 w-4" /> },
}

export function DeadlineEscapeHatchCard({ task }: DeadlineEscapeHatchCardProps) {
  const [hutch, setHutch] = useState<DeadlineEscapeHatch | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Compute lazily — only when the card is first rendered
  if (!hutch && !dismissed) {
    const result = checkDeadlineEscapeHatch(task)
    if (result.triggered) {
      return <EscapeHatchCardContent task={task} hutch={result} onDismiss={() => setDismissed(true)} />
    }
    return null
  }

  if (!hutch || dismissed) return null

  return <EscapeHatchCardContent task={task} hutch={hutch} onDismiss={() => setDismissed(true)} />
}

function EscapeHatchCardContent({
  task,
  hutch,
  onDismiss,
}: {
  task: Task
  hutch: DeadlineEscapeHatch
  onDismiss: () => void
}) {
  const suggestion = SUGGESTION_LABELS[hutch.suggestion]

  return (
    <Card className="border-destructive/30 bg-destructive/5 mb-6 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">
              Deadline Escape Hatch
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-muted-foreground"
            onClick={onDismiss}
            aria-label="Dismiss escape hatch suggestion"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <CardDescription>
          {hutch.reason}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 pb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Push count:</span>
            <Badge variant="destructive" className="text-xs">
              {hutch.pushCount}
            </Badge>
          </div>
          {hutch.originalDeadline && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Last changed:</span>
              <span className="text-xs">
                {formatDateTime(task.updated_at)}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={hutch.suggestion === 'decompose' ? 'default' : 'outline'}
            className="gap-1.5"
            onClick={() => {
              if (hutch.suggestion === 'decompose') {
                window.location.href = `/task/${task.id}/archeology`
              }
            }}
          >
            {suggestion.icon}
            {suggestion.label}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(task.id)
              // The "accept" suggestion means: just acknowledge and move on
            }}
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
