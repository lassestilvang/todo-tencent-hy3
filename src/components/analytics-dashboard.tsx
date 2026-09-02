'use client'

import { useState, useEffect } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Calendar, TrendingUp, Target, Clock, Trophy, Zap } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, subDays, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface TaskStats {
  date: string
  completed: number
  created: number
  totalTime: number
  estimatedTime: number
}

interface AnalyticsData {
  dailyStats: TaskStats[]
  weeklyCompletion: number
  monthlyCompletion: number
  totalTasks: number
  completedTasks: number
  averageCompletionTime: number
  streak: number
  longestStreak: number
}

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('week')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function fetchAnalytics() {
      try {
        // In a real app, this would call an API endpoint
        // For now, we'll generate mock data
        const mockData = generateMockData(timeRange)
        if (mounted) {
          setData(mockData)
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchAnalytics()

    return () => {
      mounted = false
    }
  }, [timeRange])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Track your productivity trends</p>
        </div>
        <Select value={timeRange} onValueChange={(value: 'week' | 'month' | 'quarter' | 'year') => setTimeRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="quarter">Last 90 Days</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Tasks Completed"
          value={data.completedTasks}
          icon={<Target className="h-5 w-5 text-green-500" />}
          trend={data.weeklyCompletion > 50 ? '+12%' : '-5%'}
          trendPositive={data.weeklyCompletion > 50}
        />
        <MetricCard
          title="Completion Rate"
          value={`${Math.round(data.weeklyCompletion)}%`}
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          trend={data.monthlyCompletion > data.weeklyCompletion ? '+3%' : '-2%'}
          trendPositive={data.monthlyCompletion > data.weeklyCompletion}
        />
        <MetricCard
          title="Current Streak"
          value={`${data.streak} days`}
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          trend={`Best: ${data.longestStreak} days`}
        />
        <MetricCard
          title="Focus Time"
          value={`${Math.round(data.averageCompletionTime / 60)}h`}
          icon={<Clock className="h-5 w-5 text-purple-500" />}
          trend="This week"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Completion Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.dailyStats}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(value, name) => [
                    (value as number) ?? 0,
                    name === 'completed' ? 'Completed' : 'Created',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="#6366f1"
                  fillOpacity={1}
                  fill="url(#colorCreated)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Estimate vs Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.dailyStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="date" type="category" tickFormatter={(v) => format(new Date(v), 'MMM d')} className="text-xs" width={60} />
                <Tooltip
                  formatter={(value, name) => [
                    (value as number) ?? 0,
                    name === 'estimatedTime' ? 'Estimated' : 'Actual',
                  ]}
                />
                <Bar dataKey="estimatedTime" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="totalTime" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly Heatmap */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyHeatmap stats={data.dailyStats} />
          </CardContent>
        </Card>

        {/* Completion by Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              By Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'High', value: Math.round(data.completedTasks * 0.4), color: '#ef4444' },
                    { name: 'Medium', value: Math.round(data.completedTasks * 0.35), color: '#f59e0b' },
                    { name: 'Low', value: Math.round(data.completedTasks * 0.2), color: '#22c55e' },
                    { name: 'None', value: Math.round(data.completedTasks * 0.05), color: '#9ca3af' },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {[
                    { name: 'High', value: Math.round(data.completedTasks * 0.4), color: '#ef4444' },
                    { name: 'Medium', value: Math.round(data.completedTasks * 0.35), color: '#f59e0b' },
                    { name: 'Low', value: Math.round(data.completedTasks * 0.2), color: '#22c55e' },
                    { name: 'None', value: Math.round(data.completedTasks * 0.05), color: '#9ca3af' },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [(value as number) ?? 0, 'Tasks']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  trendPositive?: boolean
}

function MetricCard({ title, value, icon, trend, trendPositive = true }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {trend && (
              <p className={cn('text-sm mt-1', trendPositive ? 'text-green-500' : 'text-red-500')}>
                {trend} vs last period
              </p>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-xl">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function WeeklyHeatmap({ stats }: { stats: TaskStats[] }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weeks = 4 // Show last 4 weeks

  const getDayStats = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return stats.find((s) => s.date === dateStr)?.completed || 0
  }

  const today = new Date()
  const startDate = subDays(today, weeks * 7)

  const weekRows = []
  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(startDate, w * 7)
    const cells = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      const count = getDayStats(date)
      const intensity = Math.min(count / 5, 1)
      cells.push(
        <div
          key={`${w}-${d}`}
          className="w-8 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors"
          style={{
            backgroundColor: count > 0 ? `rgba(34, 197, 94, ${0.2 + intensity * 0.8})` : 'rgba(0,0,0,0.03)',
            color: count > 0 ? '#15803d' : 'transparent',
          }}
          title={`${format(date, 'MMM d, yyyy')}: ${count} tasks`}
        >
          {count > 0 && count}
        </div>
      )
    }
    weekRows.push(
      <div key={w} className="flex gap-1 items-center">
        <span className="w-10 text-xs text-muted-foreground text-right pr-2">
          {format(weekStart, 'MMM d')}
        </span>
        <div className="flex gap-1">{cells}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 pl-10">
        {days.map((day) => (
          <div key={day} className="w-8 text-center text-xs text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      <div className="space-y-1 pl-10">{weekRows}</div>
    </div>
  )
}

function generateMockData(range: 'week' | 'month' | 'quarter' | 'year'): AnalyticsData {
  const days = range === 'week' ? 7 : range === 'month' ? 30 : range === 'quarter' ? 90 : 365
  const dailyStats: TaskStats[] = []
  let totalCompleted = 0
  let totalCreated = 0
  let totalTime = 0

  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const completed = Math.floor(Math.random() * 8)
    const created = Math.floor(Math.random() * 5) + 1
    const time = Math.floor(Math.random() * 180) + 30
    const estimated = Math.floor(Math.random() * 240) + 60

    dailyStats.push({
      date,
      completed,
      created,
      totalTime: time,
      estimatedTime: estimated,
    })

    totalCompleted += completed
    totalCreated += created
    totalTime += time
  }

  // Calculate streak
  let streak = 0
  for (let i = dailyStats.length - 1; i >= 0; i--) {
    if (dailyStats[i].completed > 0) streak++
    else break
  }

  return {
    dailyStats,
    weeklyCompletion: totalCreated > 0 ? (totalCompleted / totalCreated) * 100 : 0,
    monthlyCompletion: totalCreated > 0 ? (totalCompleted / totalCreated) * 100 * 0.9 : 0,
    totalTasks: totalCreated,
    completedTasks: totalCompleted,
    averageCompletionTime: totalCompleted > 0 ? totalTime / totalCompleted : 0,
    streak,
    longestStreak: Math.max(streak, Math.floor(Math.random() * 14) + 7),
  }
}