'use client'

import { useMemo, useState } from 'react'
import { format, subDays, eachDayOfInterval, format as dateFnsFormat } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface CalendarHeatmapProps {
  tasks?: Task[]
}

/** Number of days to show on the heatmap. */
const DAYS_SHOWN = 90

/** Color intensity levels based on task count. */
const LEVEL_COLORS = [
  'bg-slate-100 dark:bg-slate-800',    // 0 tasks
  'bg-blue-200/60 dark:bg-blue-900/40', // 1 task
  'bg-blue-300/70 dark:bg-blue-800/50', // 2 tasks
  'bg-blue-400/70 dark:bg-blue-700/60', // 3 tasks
  'bg-blue-500/70 dark:bg-blue-600/70', // 4+ tasks
]

function getLevel(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

function getColorClass(level: number): string {
  return LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)]
}

function getTaskCountForDate(dateStr: string, tasksByDate: Map<string, Task[]>): number {
  const tasks = tasksByDate.get(dateStr) || []
  return tasks.filter(t => t.completed).length
}

export function CalendarHeatmap({ tasks = [] }: CalendarHeatmapProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const { days, tasksByDate } = useMemo(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, DAYS_SHOWN - 1)
    const dates = eachDayOfInterval({ start: startDate, end: endDate })

    const byDate = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.completed_at) continue
      const dateStr = task.completed_at.split('T')[0]
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, [])
      }
      byDate.get(dateStr)!.push(task)
    }

    return { days: dates, tasksByDate: byDate }
  }, [tasks])

  const months = useMemo(() => {
    const monthLabels: { date: string; label: string }[] = []
    let currentMonth = ''

    for (const day of days) {
      const monthLabel = dateFnsFormat(day, 'MMM')
      if (monthLabel !== currentMonth) {
        currentMonth = monthLabel
        monthLabels.push({
          date: format(day, 'yyyy-MM-dd'),
          label: monthLabel,
        })
      }
    }

    return monthLabels
  }, [days])

  // Group days into weeks for display
  const weeks = useMemo(() => {
    const weekGroups: Date[][] = []
    let currentWeek: Date[] = []

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const dayOfWeek = day.getDay()

      if (i === 0 && dayOfWeek !== 0) {
        for (let p = 0; p < dayOfWeek; p++) {
          currentWeek.push(new Date(NaN))
        }
      }

      currentWeek.push(day)

      if (dayOfWeek === 6 || i === days.length - 1) {
        weekGroups.push(currentWeek)
        currentWeek = []
      }
    }

    return weekGroups
  }, [days])

  // Calculate approximate positions for month labels
  const getMonthPosition = (monthDate: string): number => {
    const monthStart = new Date(monthDate)
    const firstDay = days[0]
    const dayDiff = monthStart.getTime() - firstDay.getTime()
    const dayIndex = Math.round(dayDiff / (24 * 60 * 60 * 1000))
    const weekIndex = Math.floor(dayIndex / 7)
    return weekIndex
  }

  return (
    <Card className="glass-effect">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
          Activity Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="relative mb-6 h-4">
            {months.map((month, i) => {
              const weekIndex = getMonthPosition(month.date)
              return (
                <span
                  key={month.label + i}
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: `${weekIndex * 20}px` }}
                >
                  {month.label}
                </span>
              )
            })}
          </div>

          {/* Heatmap grid */}
          <div className="flex gap-1">
            {weeks.map((week, weekIdx) => (
              <div key={`week-${weekIdx}`} className="flex flex-col gap-0.5">
                {week.map((day, dayIdx) => {
                  const isPadding = isNaN(day.getTime())
                  const dateStr = !isPadding ? format(day, 'yyyy-MM-dd') : null
                  const count = !isPadding
                    ? getTaskCountForDate(dateStr!, tasksByDate)
                    : 0
                  const level = !isPadding ? getLevel(count) : -1

                  return (
                    <div
                      key={`day-${weekIdx}-${dayIdx}`}
                      className="relative"
                      onMouseEnter={() => !isPadding && dateStr && setHoveredDate(dateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                    >
                      <div
                        className={cn(
                          'h-3 w-3 rounded-sm transition-all',
                          level >= 0 ? getColorClass(level) : 'bg-transparent',
                          !isPadding && 'hover:brightness-110 cursor-pointer',
                          hoveredDate === dateStr && 'ring-1 ring-primary'
                        )}
                        title={
                          dateStr
                            ? `${format(new Date(dateStr), 'MMM d, yyyy')}: ${count} task${count !== 1 ? 's' : ''} completed`
                            : ''
                        }
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
            <span>Less</span>
            {LEVEL_COLORS.map((colorClass, i) => (
              <div
                key={i}
                className={cn('h-3 w-3 rounded-sm', colorClass)}
                title={i === 0 ? '0 tasks' : `${i} task${i > 1 ? 's' : ''}`}
              />
            ))}
            <span>More</span>
          </div>

          {hoveredDate && (
            <div className="mt-2 text-sm">
              <span className="font-medium">
                {format(new Date(hoveredDate), 'MMMM d, yyyy')}:{' '}
              </span>
              {(() => {
                const count = getTaskCountForDate(hoveredDate, tasksByDate)
                return count === 0
                  ? 'No tasks completed'
                  : `${count} task${count !== 1 ? 's' : ''} completed`
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
