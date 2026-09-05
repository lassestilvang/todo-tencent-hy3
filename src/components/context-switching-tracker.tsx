'use client'

import { useMemo, useState, useEffect } from 'react'
import { format, isToday, isYesterday, subDays, startOfDay, addHours } from 'date-fns'
import {
  ArrowLeftRight,
  Clock,
  BarChart3,
  TrendingDown,
  CheckCircle,
  PauseCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Task, TaskLog } from '@/types'
import { cn, formatTime } from '@/lib/utils'

interface ContextSwitchTrackerProps {
  tasks: Task[]
  logs: TaskLog[]
}

interface ContextSwitchEvent {
  id: string
  timestamp: string
  fromTask: string
  toTask: string
  estimatedCost: number
}

interface SwitchCostMetrics {
  totalSwitches: number
  totalEstimatedLostTime: number
  avgCostPerSwitch: number
  productivityImpact: number
  recommendation: string
}

const DEFAULT_CONTEXT_SWITCH_COST = 15 // minutes (cognitive research suggests 15-25 min)

export function ContextSwitchTracker({ tasks, logs }: ContextSwitchTrackerProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'all'>('today')

  // Parse the task logs to reconstruct task switching events
  const switchEvents = useMemo(() => {
    if (!logs || logs.length === 0) return []

    // Get unique task IDs from logs, in chronological order
    const taskActivity: { taskId: string; timestamp: string; action: string }[] = []

    for (const log of logs) {
      if (log.action === 'completed' || log.action === 'created' || log.action === 'updated') {
        taskActivity.push({
          taskId: log.task_id,
          timestamp: log.created_at,
          action: log.action,
        })
      }
    }

    // Sort by timestamp
    taskActivity.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    // Find switches: consecutive different task IDs where a task was marked completed
    // followed by a different task being worked on
    const events: ContextSwitchEvent[] = []
    let lastTouchedTaskId: string | null = null

    for (let i = 0; i < taskActivity.length; i++) {
      const activity = taskActivity[i]
      if (activity.taskId !== lastTouchedTaskId && lastTouchedTaskId !== null) {
        const cost = DEFAULT_CONTEXT_SWITCH_COST // 15 min per switch estimate
        events.push({
          id: `${activity.timestamp}-${activity.taskId}`,
          timestamp: activity.timestamp,
          fromTask: lastTouchedTaskId,
          toTask: activity.taskId,
          estimatedCost: cost,
        })
      }
      lastTouchedTaskId = activity.taskId
    }

    return events
  }, [logs])

  // Filter events by selected period
  const filteredEvents = useMemo(() => {
    if (selectedPeriod === 'all') return switchEvents

    const now = new Date()
    let cutoff: Date

    if (selectedPeriod === 'today') {
      cutoff = startOfDay(now)
    } else {
      // week
      cutoff = subDays(now, 7)
    }

    return switchEvents.filter(
      (event) => new Date(event.timestamp) >= cutoff
    )
  }, [switchEvents, selectedPeriod])

  // Calculate metrics
  const metrics = useMemo((): SwitchCostMetrics => {
    if (filteredEvents.length === 0) {
      return {
        totalSwitches: 0,
        totalEstimatedLostTime: 0,
        avgCostPerSwitch: 0,
        productivityImpact: 0,
        recommendation: 'No task switching detected in the selected period.',
      }
    }

    const totalSwitches = filteredEvents.length
    const totalEstimatedLostTime = filteredEvents.reduce(
      (sum, e) => sum + e.estimatedCost,
      0
    )
    const avgCostPerSwitch = totalEstimatedLostTime / totalSwitches

    // Productivity impact: what percentage of your work time was lost to switching?
    const periodHours = selectedPeriod === 'today' ? 8 : selectedPeriod === 'week' ? 40 : 168
    const impact = Math.min(1, (totalEstimatedLostTime / (periodHours * 60)) * 10)

    let recommendation = ''
    if (totalSwitches <= 2) {
      recommendation = 'Great job batching similar tasks! Your context switching is at a healthy level.'
    } else if (totalSwitches <= 5) {
      recommendation = 'You have a moderate number of switches. Try grouping similar tasks together to reduce context switching costs.'
    } else {
      recommendation = `High context switching detected (${totalSwitches} switches). Try blocking time for similar tasks to recover ${totalEstimatedLostTime} minutes of lost focus time.`
    }

    return {
      totalSwitches,
      totalEstimatedLostTime,
      avgCostPerSwitch,
      productivityImpact: Math.round(impact * 100),
      recommendation,
    }
  }, [filteredEvents, selectedPeriod])

  const getTaskName = (taskId: string | null): string => {
    if (!taskId) return 'unknown'
    return tasks.find((t) => t.id === taskId)?.name || 'Unknown task'
  }

  return (
    <Card className="glass-effect">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase text-muted-foreground">
            Context Switching Costs
          </span>
          <div className="flex gap-1">
            {(['today', 'week', 'all'] as const).map((period) => (
              <Badge
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                className="text-xs cursor-pointer capitalize"
                onClick={() => setSelectedPeriod(period)}
              >
                {period}
              </Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-xl font-bold">{metrics.totalSwitches}</div>
              <div className="text-xs text-muted-foreground">Switches</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-xl font-bold">{formatTime(metrics.totalEstimatedLostTime)}</div>
              <div className="text-xs text-muted-foreground">Lost Time</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            <div>
              <div className="text-xl font-bold">{Math.round(metrics.avgCostPerSwitch)}m</div>
              <div className="text-xs text-muted-foreground">Per Switch</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-xl font-bold">{metrics.productivityImpact}%</div>
              <div className="text-xs text-muted-foreground">Impact</div>
            </div>
          </div>
        </div>

        {/* Productivity Impact Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-muted-foreground">Productivity Impact</span>
            <span className="text-xs text-muted-foreground">
              {metrics.productivityImpact}% of work time
            </span>
          </div>
          <Progress value={metrics.productivityImpact} className="h-2" />
        </div>

        {/* Recommendation */}
        <div className={cn(
          'rounded-lg border p-3 text-sm',
          metrics.totalSwitches <= 2
            ? 'border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/30'
            : metrics.totalSwitches <= 5
              ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/30'
              : 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/30'
        )}>
          <div className="flex items-start gap-2">
            <ArrowLeftRight className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{metrics.recommendation}</span>
          </div>
        </div>

        {/* Switch Events Timeline */}
        {filteredEvents.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Recent Switches
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filteredEvents.slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                    <ArrowLeftRight className="h-2.5 w-2.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground truncate">
                        {getTaskName(event.fromTask)}
                      </span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="truncate">
                        {getTaskName(event.toTask)}
                      </span>
                    </div>
                    <div className="text-muted-foreground/60">
                      {format(new Date(event.timestamp), 'MMM d, h:mm a')}{' '}
                      · ~{Math.round(event.estimatedCost)} min lost
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
