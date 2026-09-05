'use client'

import { useMemo, useState } from 'react'
import { BarChart3, TrendingUp, Users, Calendar, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, startOfMonth, endOfMonth } from 'date-fns'
import type { Task, TaskLog, List } from '@/types'
import { BarChart } from '@/components/analytics/bar-chart'

interface TeamVelocityDashboardProps {
  tasks: Task[]
  logs: TaskLog[]
  lists?: List[]
}

type TimeRange = 'week' | 'month' | 'quarter'
type VelocityMetric = 'completed' | 'created' | 'timeSpent' | 'tasksPerDay'

/**
 * Team Velocity Dashboard
 *
 * Displays productivity metrics over time, similar to a Jira
 * sprint dashboard. Shows:
 * - Tasks completed per day/week
 * - Task creation rate vs completion rate (burndown)
 * - Time spent estimates vs actuals
 * - Top productive lists/projects
 * - Velocity trends across time ranges
 */
export function TeamVelocityDashboard({ tasks, logs, lists = [] }: TeamVelocityDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [metric, setMetric] = useState<VelocityMetric>('completed')

  const dateRange = useMemo(() => {
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (timeRange) {
      case 'week':
        start = subWeeks(startOfWeek(now), 7)
        end = endOfWeek(now)
        break
      case 'month':
        start = startOfMonth(now)
        end = endOfMonth(now)
        break
      case 'quarter':
        start = subWeeks(now, 12)
        end = now
        break
    }

    return { start, end }
  }, [timeRange])

  // Compute daily velocity data
  const dailyData = useMemo(() => {
    const days =
      timeRange === 'week'
        ? eachDayOfInterval(dateRange)
        : timeRange === 'month'
          ? eachDayOfInterval(dateRange)
          : eachDayOfInterval(dateRange)

    const data: { date: string; label: string; completed: number; created: number; timeSpent: number }[] = []

    for (const day of days) {
      const dayStr = day.toISOString().split('T')[0]
      const dayTasks = tasks.filter((t) => {
        const completedAt = t.completed_at?.split('T')[0]
        const createdAt = t.created_at?.split('T')[0]
        return completedAt === dayStr || createdAt === dayStr
      })

      const completed = tasks.filter((t) => t.completed_at?.split('T')[0] === dayStr).length
      const created = tasks.filter((t) => t.created_at?.split('T')[0] === dayStr).length

      // Sum time spent for tasks completed on this day
      const timeSpent = tasks
        .filter((t) => t.completed_at?.split('T')[0] === dayStr)
        .reduce((sum, t) => sum + (t.actual_time || 0), 0)

      data.push({
        date: dayStr,
        label: format(day, 'EEE d'),
        completed,
        created,
        timeSpent,
      })
    }

    return data
  }, [tasks, dateRange, timeRange])

  // Burndown data: remaining tasks
  const burndownData = useMemo(() => {
    const days =
      timeRange === 'week'
        ? eachDayOfInterval(dateRange)
        : eachDayOfInterval(dateRange)

    // Count tasks that existed at the start of the range
    const openTasksAtStart = tasks.filter(
      (t) => !t.completed && t.created_at && new Date(t.created_at) <= dateRange.start
    )

    const data: { date: string; label: string; remaining: number; planned: number }[] = []

    for (const day of days) {
      const dayStr = day.toISOString().split('T')[0]
      const completedBy = tasks.filter(
        (t) => t.completed && t.completed_at && t.completed_at.split('T')[0] <= dayStr
      ).length
      const createdBy = tasks.filter(
        (t) => t.created_at && t.created_at.split('T')[0] <= dayStr
      ).length
      const remaining = createdBy - completedBy

      data.push({
        date: dayStr,
        label: format(day, 'EEE d'),
        remaining: Math.max(0, remaining),
        planned: Math.max(0, openTasksAtStart.length - completedBy),
      })
    }

    return data
  }, [tasks, dateRange, timeRange])

  // Top productive lists
  const listStats = useMemo(() => {
    return lists
      .map((list) => {
        const listTasks = tasks.filter((t) => t.list_id === list.id)
        const completed = listTasks.filter((t) => t.completed)
        const timeSpent = completed.reduce((sum, t) => sum + (t.actual_time || 0), 0)
        const estAccuracy =
          completed.filter((t) => t.estimate && t.actual_time).length > 0
            ? completed.reduce((sum, t, _, arr) => {
                const est = t.estimate || 0
                const actual = t.actual_time || 0
                return sum + (est > 0 ? actual / est / arr.length : 0)
              }, 0) * (completed.length / completed.filter((t) => t.estimate).length || 1)
            : 0

        return {
          list,
          total: listTasks.length,
          completed: completed.length,
          completionRate: listTasks.length > 0 ? completed.length / listTasks.length : 0,
          timeSpent,
          estAccuracy,
        }
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
  }, [tasks, lists])

  // Team members workload (if tasks have assignees)
  const memberStats = useMemo(() => {
    const members = new Map<string, { name: string; assigned: number; completed: number; timeSpent: number }>()

    for (const task of tasks) {
      if (!task.assignee_id) continue
      const name = task.assignee?.name || task.assignee_id || 'Unknown'

      if (!members.has(task.assignee_id)) {
        members.set(task.assignee_id, { name, assigned: 0, completed: 0, timeSpent: 0 })
      }

      const stats = members.get(task.assignee_id)!
      stats.assigned++
      if (task.completed) {
        stats.completed++
        stats.timeSpent += task.actual_time || 0
      }
    }

    return Array.from(members.values()).sort((a, b) => b.completed - a.completed)
  }, [tasks])

  const selectedData = metric === 'completed' ? dailyData.map((d) => d.completed) :
    metric === 'created' ? dailyData.map((d) => d.created) :
    metric === 'timeSpent' ? dailyData.map((d) => d.timeSpent / 60) :
    dailyData.map((d) => d.completed + d.created > 0 ? (d.completed / (d.completed + d.created)) * 100 : 0)

  const colors = metric === 'completed' ? '#6366f1' :
    metric === 'created' ? '#8b5cf6' :
    metric === 'timeSpent' ? '#22c55e' : '#f59e0b'

  const exportCSV = () => {
    const csv = [
      ['Date', 'Completed', 'Created', 'Time Spent (hrs)', 'Remaining', 'Planned'],
      ...dailyData.map((d, i) => [
        d.date,
        d.completed,
        d.created,
        (d.timeSpent / 60).toFixed(1),
        burndownData[i]?.remaining || 0,
        burndownData[i]?.planned || 0,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `velocity-${timeRange}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={metric} onValueChange={(v: any) => setMetric(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Tasks Completed</SelectItem>
              <SelectItem value="created">Tasks Created</SelectItem>
              <SelectItem value="timeSpent">Time Spent (hrs)</SelectItem>
              <SelectItem value="tasksPerDay">Completion Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Summary Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasks.filter((t) => t.completed).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(dailyData.reduce((sum, d) => sum + d.completed, 0) / (dailyData.length || 1)).toFixed(0)} per day avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(dailyData.reduce((sum, d) => sum + d.timeSpent, 0) / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(dailyData.reduce((sum, d) => sum + d.timeSpent, 0) / (dailyData.reduce((sum, d) => sum + d.completed, 0) || 1))} min/task avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((tasks.filter((t) => t.completed).length / (tasks.length || 1)) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {tasks.length} total tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {metric === 'completed' ? 'Tasks Completed' :
             metric === 'created' ? 'Tasks Created' :
             metric === 'timeSpent' ? 'Time Spent' : 'Completion Rate'} Over Time
          </CardTitle>
          <CardDescription>
            {format(dateRange.start, 'MMM d')} → {format(dateRange.end, 'MMM d, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            data={selectedData}
            labels={dailyData.map((d) => d.label)}
            color={colors}
            height={200}
          />
        </CardContent>
      </Card>

      {/* Burndown Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Burndown Chart
          </CardTitle>
          <CardDescription>Actual vs planned task completion</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            data={burndownData.map((d) => d.remaining)}
            labels={burndownData.map((d) => d.label)}
            color="#ef4444"
            height={150}
          />
          <p className="text-xs text-muted-foreground mt-3">
            Remaining tasks per day. Lower is better — shows consistent progress.
          </p>
        </CardContent>
      </Card>

      {/* List Performance */}
      {listStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              List Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {listStats.map(({ list, completed, total, completionRate, timeSpent }) => (
                <div key={list.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className="font-medium">{list.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      {completed}/{total} completed
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(completionRate * 100)}%
                    </Badge>
                    <span className="text-muted-foreground">
                      {Math.round(timeSpent / 60)}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Member Stats */}
      {memberStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Team Member Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {memberStats.map((member) => (
                <div key={member.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium">{member.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {member.assigned} tasks assigned
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-medium">{member.completed} done</span>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(member.timeSpent / 60)}h spent
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
