'use client'

import { AlertTriangle, GitBranch, Archive, CheckCircle, Sparkles, RefreshCw, BarChart3, Calendar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'
import { generateTaskAutopsy, type TaskAutopsy, type AutopsyRecommendation } from '@/lib/task-autopsy'

interface TaskAutopsyCardProps {
  task: Task
}

const RECOMMENDATION_ICONS: Record<AutopsyRecommendation, React.ReactNode> = {
  decompose: <GitBranch className="h-4 w-4" />,
  archive: <Archive className="h-4 w-4" />,
  mark_complete: <CheckCircle className="h-4 w-4" />,
  renegotiate: <RefreshCw className="h-4 w-4" />,
  template: <Sparkles className="h-4 w-4" />,
}

const FINDING_ICONS: Record<TaskAutopsy['findings'][number]['type'], React.ReactNode> = {
  deadline_thrash: <BarChart3 className="h-4 w-4 text-orange-500" />,
  reopened_repeatedly: <RefreshCw className="h-4 w-4 text-red-500" />,
  update_churn: <BarChart3 className="h-4 w-4 text-yellow-500" />,
  long_stall: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  overestimated: <Calendar className="h-4 w-4 text-blue-500" />,
  no_progress: <AlertTriangle className="h-4 w-4 text-slate-500" />,
}

export function TaskAutopsyCard({ task }: TaskAutopsyCardProps) {
  const autopsy = generateTaskAutopsy(task)

  if (!autopsy.stalled || autopsy.findings.length === 0) {
    return null
  }

  const criticalFindings = autopsy.findings.filter((f) => f.severity === 'critical')

  return (
    <Card className="border-orange-500/30 bg-orange-500/5 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">
              Task Autopsy{' '}
              {criticalFindings.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {criticalFindings.length} critical
                </Badge>
              )}
            </CardTitle>
          </div>
        </div>
        <CardDescription>
          {autopsy.findings.length} issues detected in this task's history.
          Here's what went wrong and how to recover.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Findings */}
        <div className="space-y-2">
          {autopsy.findings.map((finding, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg border p-3',
                finding.severity === 'critical'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-border/20 bg-accent/5',
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {FINDING_ICONS[finding.type]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{finding.title}</span>
                    <Badge
                      variant={finding.severity === 'critical' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {finding.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {finding.insight}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{autopsy.updateCount} edits</span>
          <span>{autopsy.deadlinePushes} deadline pushes</span>
          <span>{autopsy.reopenCount} reopens</span>
          {autopsy.daysOpen > 0 && (
            <span>{autopsy.daysOpen} days open</span>
          )}
        </div>

        {/* Recommendations */}
        <div className="border-t pt-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Recommended actions
          </p>
          <div className="flex flex-wrap gap-2">
            {autopsy.recommendations.map((rec) => (
              <Button
                key={rec.action}
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (rec.action === 'decompose') {
                    window.location.href = `/task/${task.id}/archeology`
                  } else if (rec.action === 'mark_complete') {
                    // Dispatch a custom event that the task checkbox can pick up
                    window.dispatchEvent(
                      new CustomEvent('task-autopsy-complete', {
                        detail: { taskId: task.id },
                      }),
                    )
                  }
                }}
              >
                {RECOMMENDATION_ICONS[rec.action]}
                {rec.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
