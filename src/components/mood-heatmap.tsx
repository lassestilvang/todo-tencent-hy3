'use client'

import type { Task } from '@/types'
import { MOOD_EMOJI, MOOD_LABELS, type TaskMood } from '@/types'
import { useMemo } from 'react'
import { format, startOfWeek, eachDayOfInterval, addDays } from 'date-fns'

interface MoodHeatmapProps {
  tasks: Task[]
  /** Number of days to show (default: 14) */
  days?: number
}

interface MoodCell {
  date: string
  mood: TaskMood
  count: number
}

/**
 * Affective heatmap: shows the distribution of mood-tagged tasks
 * across recent days. Hover a cell to see the breakdown.
 * Tasks without a mood are excluded.
 */
export function MoodHeatmap({ tasks, days = 14 }: MoodHeatmapProps) {
  const cells = useMemo(() => {
    const now = new Date()
    const startDate = addDays(now, -(days - 1))

    // Group tasks by date + mood
    const byDate: Record<string, Record<TaskMood, number>> = {}

    tasks.forEach((task) => {
      if (!task.mood) return
      const taskDate = task.date || task.deadline
      if (!taskDate) return
      const dayKey = taskDate.slice(0, 10) // YYYY-MM-DD
      if (!byDate[dayKey]) {
        byDate[dayKey] = { fun: 0, grind: 0, urgent: 0, thinking: 0, learn: 0, calm: 0 }
      }
      byDate[dayKey][task.mood] = (byDate[dayKey][task.mood] || 0) + 1
    })

    const cells: MoodCell[] = []
    for (let i = 0; i < days; i++) {
      const day = addDays(startDate, i)
      const dayKey = format(day, 'yyyy-MM-dd')
      const dayData = byDate[dayKey]
      if (dayData) {
        for (const mood of ['fun', 'grind', 'urgent', 'thinking', 'learn', 'calm'] as TaskMood[]) {
          if (dayData[mood] > 0) {
            cells.push({ date: dayKey, mood, count: dayData[mood] })
          }
        }
      }
    }

    return cells
  }, [tasks, days])

  if (cells.length === 0) {
    return (
      <div className="text-muted-foreground text-center text-sm py-6">
        No mood tags yet. Add a mood to tasks in the create/edit form!
      </div>
    )
  }

  // Build a daily grid
  const now = new Date()
  const startDate = addDays(now, -(days - 1))
  const dayKeys = Array.from({ length: days }, (_, i) =>
    format(addDays(startDate, i), 'yyyy-MM-dd')
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mood heatmap</h3>
        <p className="text-xs text-muted-foreground">
          {format(startDate, 'MMM d')} – {format(now, 'MMM d')}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {dayKeys.map((dayKey) => {
          const dayCells = cells.filter((c) => c.date === dayKey)
          const max = 3
          return (
            <div key={dayKey} className="flex flex-col items-center gap-0.5">
              <span className="text-muted-foreground/50">{format(new Date(dayKey), 'eee')}</span>
              <div className="flex flex-wrap justify-center gap-0.5">
                {dayCells.map((c) => (
                  <span
                    key={c.mood}
                    title={`${MOOD_LABELS[c.mood]} ×${c.count} on ${c.date}`}
                    className="leading-none"
                    style={{
                      fontSize: `${Math.min(1.2, 0.8 + c.count / max)}rem`,
                    }}
                  >
                    {MOOD_EMOJI[c.mood]}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center gap-3 pt-1 text-xs text-muted-foreground">
        {(['fun', 'grind', 'urgent', 'thinking', 'learn', 'calm'] as TaskMood[]).map(
          (mood) => (
            <span key={mood}>
              {MOOD_EMOJI[mood]} {MOOD_LABELS[mood]}
            </span>
          )
        )}
      </div>
    </div>
  )
}
