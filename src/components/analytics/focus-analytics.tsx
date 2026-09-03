'use client'

import { useSyncExternalStore, useMemo } from 'react'
import { Flame, Target, Clock, CalendarCheck } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { computeHabitMetrics } from '@/lib/focus/habit-metrics'
import {
  parseFocusSessions,
  STORAGE_KEY,
} from '@/lib/focus/session-log'
import type { HabitMetrics } from '@/lib/focus/habit-metrics'
import { format, parseISO } from 'date-fns'

// localStorage emits no change events, so the store is
// subscribed with a no-op — the analytics view only needs
// the history as it is at mount.
function subscribeToFocusHistory() {
  return () => undefined
}

function getFocusHistorySnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

function getFocusHistoryServerSnapshot(): string {
  return ''
}

const STAT_CARDS = [
  { key: 'currentStreak', label: 'Day Streak', icon: Flame },
  { key: 'completionRate', label: 'Completion', icon: Target },
  { key: 'totalFocusMinutes', label: 'Focus Time', icon: Clock },
  { key: 'averageSessionMinutes', label: 'Avg Session', icon: CalendarCheck },
] as const

function statValue(metrics: HabitMetrics, key: (typeof STAT_CARDS)[number]['key']): string {
  switch (key) {
    case 'completionRate':
      return `${Math.round(metrics.completionRate * 100)}%`
    case 'totalFocusMinutes':
      return `${Math.floor(metrics.totalFocusMinutes / 60)}h ${Math.round(metrics.totalFocusMinutes % 60)}m`
    case 'averageSessionMinutes':
      return `${Math.round(metrics.averageSessionMinutes)}m`
    default:
      return String(metrics.currentStreak)
  }
}

export function FocusAnalytics() {
  // Reading through useSyncExternalStore keeps the server
  // render (empty history) and the hydrated client render
  // (localStorage history) consistent without a setState effect.
  const raw = useSyncExternalStore(
    subscribeToFocusHistory,
    getFocusHistorySnapshot,
    getFocusHistoryServerSnapshot
  )
  const metrics: HabitMetrics = useMemo(
    () => computeHabitMetrics(parseFocusSessions(raw)),
    [raw]
  )
  const hasSessions = metrics.totalSessions > 0

  if (!hasSessions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Focus Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No focus sessions yet. Open Focus Mode from the timer to start one —
            completed sessions show up here and the Pomodoro duration adapts to
            how often you finish them.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Habit stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STAT_CARDS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xl font-bold">{statValue(metrics, key)}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Last 7 days */}
        <div>
          <p className="text-sm font-medium mb-3">
            Focus time — last 7 days
            <span className="text-muted-foreground font-normal">
              {' '}
              (longest streak: {metrics.longestStreak} days)
            </span>
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => format(parseISO(value), 'EEE')}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} unit="m" />
                <Tooltip
                  labelFormatter={(label) =>
                    format(parseISO(String(label)), 'EEEE, MMM d')
                  }
                  formatter={(value, name) => [
                    `${value ?? 0}m`,
                    name === 'minutes' ? 'Focus time' : String(name),
                  ]}
                />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
