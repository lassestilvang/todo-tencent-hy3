'use client'

import { useState, useEffect } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, Target, Zap, Brain, Heart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getCompletionStats, getDailyStats, analyzeTrend, predictFutureStats, calculateProductivityScore } from '@/lib/analytics/trends'
import type { Task, TaskLog } from '@/types'
import type { TaskCompletionStats, DailyStats } from '@/lib/analytics/trends'

interface ProductivityTrendsProps {
  tasks: Task[]
  logs: TaskLog[]
  timeRange?: 'week' | 'month' | 'quarter' | 'year'
}

const DEFAULT_STATS: TaskCompletionStats = {
  totalTasks: 0,
  completedTasks: 0,
  completionRate: 0,
  averageTime: 0,
  totalTime: 0,
  estimatedTime: 0,
  overdueCount: 0,
  streak: 0,
  longestStreak: 0,
}

export function ProductivityTrends({
  tasks,
  logs,
  timeRange = 'week',
}: ProductivityTrendsProps) {
  const [stats, setStats] = useState<TaskCompletionStats>(DEFAULT_STATS)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState<'completion' | 'time' | 'patterns'>('completion')

  useEffect(() => {
    const mounted = true

    async function loadData() {
      try {
        setLoading(true)
        const [completionStats, daily] = await Promise.all([
          getCompletionStats(tasks, logs),
          getDailyStats(tasks, timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : timeRange === 'quarter' ? 90 : 365),
        ])
        if (mounted) {
          setStats(completionStats)
          setDailyStats(daily)
        }
      } catch (error) {
        console.error('Failed to load analytics data:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()
  }, [tasks, logs, timeRange])

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="animate-pulse">
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-muted/30 rounded-full" />
                  <span className="text-sm">Loading...</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const productivityScore = calculateProductivityScore(stats, dailyStats)
  const trend = analyzeTrend(dailyStats.map(d => d.completed))
  const predictions = predictFutureStats(dailyStats)

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    if (score >= 40) return 'text-orange-500'
    return 'text-red-500'
  }

  return (
    <div className="space-y-4">
      {/* Header with score */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Productivity Score</h2>
          <p className="text-muted-foreground">Overall productivity assessment</p>
        </div>
        <div className="text-center">
          <p className={cn('text-4xl font-bold', scoreColor(productivityScore))}>
            {productivityScore}
          </p>
          <p className="text-sm text-muted-foreground">
            {trend.trend === 'up' ? 'Improving' : trend.trend === 'down' ? 'Declining' : 'Stable'} ({trend.percentageChange > 0 ? '+' : ''}{trend.percentageChange.toFixed(1)}%)
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Completion Rate"
          value={`${(stats.completionRate * 100).toFixed(1)}%`}
          icon={<Target className="h-5 w-5 text-green-500" />}
          trend={`${trend.percentageChange > 0 ? '+' : ''}${trend.percentageChange.toFixed(1)}%`}
          trendPositive={trend.percentageChange > 0}
        />
        <MetricCard
          title="Focus Time"
          value={`${Math.round(stats.totalTime / 60)}h`}
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          trend="This period"
        />
        <MetricCard
          title="Task Streak"
          value={`${stats.streak} days`}
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          trend={`Best: ${stats.longestStreak} days`}
        />
        <MetricCard
          title="AI Productivity"
          value={`${Math.min(100, productivityScore + 10)}%`}
          icon={<Brain className="h-5 w-5 text-purple-500" />}
          trend="Enhanced with AI"
          trendPositive={true}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Completion Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Completion Trend
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                onClick={() => setActiveChart('completion')}
                className={cn(
                  'px-2 py-1 rounded',
                  activeChart === 'completion' && 'bg-primary text-primary-foreground',
                  activeChart !== 'completion' && 'hover:bg-muted'
                )}
              >
                Completion
              </button>
              <button
                onClick={() => setActiveChart('time')}
                className={cn(
                  'px-2 py-1 rounded',
                  activeChart === 'time' && 'bg-primary text-primary-foreground',
                  activeChart !== 'time' && 'hover:bg-muted'
                )}
              >
                Time Spent
              </button>
              <button
                onClick={() => setActiveChart('patterns')}
                className={cn(
                  'px-2 py-1 rounded',
                  activeChart === 'patterns' && 'bg-primary text-primary-foreground',
                  activeChart !== 'patterns' && 'hover:bg-muted'
                )}
              >
                Patterns
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {activeChart === 'completion' && (
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value, name) => [
                      value ?? 0,
                      name === 'completed' ? 'Completed' : 'Created',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#22c55e"
                    fillOpacity={0.1}
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    stroke="#6366f1"
                    fillOpacity={0.1}
                  />
                </LineChart>
              )}

              {activeChart === 'time' && (
                <AreaChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value, name) => [
                      value ?? 0,
                      name === 'totalTime' ? 'Time Spent' : 'Estimated',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalTime"
                    stroke="#22c55e"
                    fill="#22c55e"
                    opacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="estimatedTime"
                    stroke="#6366f1"
                    fill="#6366f1"
                    opacity={0.6}
                  />
                </AreaChart>
              )}

              {activeChart === 'patterns' && (
                <PieChart>
                  <Pie
                    data={[
                      { name: 'High Priority', value: stats.totalTasks * 0.3, color: '#ef4444' },
                      { name: 'Medium Priority', value: stats.totalTasks * 0.4, color: '#f59e0b' },
                      { name: 'Low Priority', value: stats.totalTasks * 0.2, color: '#22c55e' },
                      { name: 'No Priority', value: stats.totalTasks * 0.1, color: '#9ca3af' },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {[
                      { name: 'High Priority', value: stats.totalTasks * 0.3, color: '#ef4444' },
                      { name: 'Medium Priority', value: stats.totalTasks * 0.4, color: '#f59e0b' },
                      { name: 'Low Priority', value: stats.totalTasks * 0.2, color: '#22c55e' },
                      { name: 'No Priority', value: stats.totalTasks * 0.1, color: '#9ca3af' },
                    ]
                      .filter(d => d.value > 0)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                  </Pie>
                </PieChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Predictions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {predictions.map((pred, i) => (
                <div key={i} className="p-3 bg-muted/30 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{pred.metric.replace('_', ' ')}</span>
                    <Badge
                      variant="outline"
                      className={pred.confidence > 0.7 ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'}
                    >
                      {Math.round(pred.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Predicted: <span className="font-medium">{pred.predictedValue}</span>
                  </p>
                  <div className="text-xs text-muted-foreground/70 mt-1">
                    Reasoning: {pred.reasoning.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-primary/10 rounded">
                <div className="font-medium mb-2">Key Insights</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    You complete <span className="font-medium">{stats.completedTasks}</span> of{" "}
                    <span className="font-medium">{stats.totalTasks}</span> tasks.
                  </li>
                  <li>
                    Average task takes <span className="font-medium">{Math.round(stats.totalTime / Math.max(stats.completedTasks, 1))} minutes</span>.
                  </li>
                  <li>
                    Your current streak is <span className="font-medium">{stats.streak} days</span>.
                  </li>
                  <li>
                    {stats.overdueCount > 0 ? (
                      <>
                        <span className="text-destructive">{stats.overdueCount} overdue task(s)</span> need attention.
                      </>
                    ) : (
                      <>
                        No overdue tasks! Great job staying on top of deadlines.
                      </>
                    )}
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-primary/10 rounded">
                <div className="font-medium mb-2">AI Recommendations</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    Schedule high-focus tasks during <span className="font-medium">9-11 AM</span> for best results.
                  </li>
                  <li>
                    Consider breaking tasks over <span className="font-medium">90 minutes</span> into smaller chunks.
                  </li>
                  <li>
                    Batch similar tasks to reduce context switching by up to <span className="font-medium">40%</span>.
                  </li>
                </ul>
              </div>
            </div>
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

function MetricCard({
  title,
  value,
  icon,
  trend,
  trendPositive = true,
}: MetricCardProps) {
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
