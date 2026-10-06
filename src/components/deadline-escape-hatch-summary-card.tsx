'use client'

import { AlertTriangle, GitBranch, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Task } from '@/types'
import type { DeadlineEscapeHatch } from '@/lib/deadline-escape-hatch'

interface DeadlineEscapeHatchSummaryCardProps {
  task: Task
  hutch: DeadlineEscapeHatch
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  decompose: <GitBranch className="h-4 w-4" />,
  template: <Sparkles className="h-4 w-4" />,
  renegotiate: <AlertTriangle className="h-4 w-4" />,
}

export function DeadlineEscapeHatchSummaryCard({
  task,
  hutch,
}: DeadlineEscapeHatchSummaryCardProps) {
  return (
    <Card className="border-orange-500/30 bg-orange-500/5 mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">Deadline thrash detected</span>
              <Badge variant="destructive" className="text-xs">
                {hutch.pushCount} pushes
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{hutch.reason}</p>
            <div className="mt-2 flex items-center gap-2">
              <Link href={`/task/${task.id}/archeology`}>
                <Badge
                  variant="outline"
                  className="cursor-pointer text-xs font-medium"
                >
                  {ACTION_ICONS[hutch.suggestion]}
                  {hutch.suggestion === 'decompose'
                    ? 'Break Down'
                    : hutch.suggestion === 'template'
                      ? 'Make Template'
                      : 'View Details'}
                </Badge>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
