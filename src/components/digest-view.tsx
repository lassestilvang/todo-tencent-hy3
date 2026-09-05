'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DigestData } from '@/lib/email-digest'
import { toast } from 'sonner'

interface DigestViewProps {
  initialDigest: DigestData
}

export function DigestView({ initialDigest }: DigestViewProps) {
  const [digest, setDigest] = useState<DigestData>(initialDigest)
  const [selectedFrequency, setSelectedFrequency] = useState<
    'daily' | 'weekly' | 'summary'
  >(initialDigest.frequency)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(
        `/api/digest?frequency=${selectedFrequency}&format=json`
      )
      if (!response.ok) throw new Error('Failed to fetch digest')
      const data = await response.json()
      setDigest(data)
      toast.success('Digest refreshed')
    } catch (error) {
      console.error(error)
      toast.error('Failed to refresh digest')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDownload = () => {
    const dataStr = JSON.stringify(digest, null, 2)
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`
    const exportFileDefaultFilename = `taskflow-digest-${digest.id}.json`

    const link = document.createElement('a')
    link.setAttribute('href', dataUri)
    link.setAttribute('download', exportFileDefaultFilename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={selectedFrequency}
            onValueChange={(value: typeof selectedFrequency) => {
              setSelectedFrequency(value)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Today Summary</SelectItem>
              <SelectItem value="daily">Daily Digest</SelectItem>
              <SelectItem value="weekly">Weekly Digest</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Summary Stats */}
      <Card className="glass-effect">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{digest.summary.totalTasksCompleted}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{digest.summary.totalTimeSpent}m</div>
                <div className="text-xs text-muted-foreground">Time Spent</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{digest.summary.averageDailyCompletion}</div>
                <div className="text-xs text-muted-foreground">Avg/Day</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{digest.summary.streakDays}</div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
            </div>
          </div>

          {digest.summary.topCategories && digest.summary.topCategories.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Top Categories
              </div>
              <div className="flex flex-wrap gap-1.5">
                {digest.summary.topCategories.map((cat) => (
                  <Badge key={cat.name} variant="secondary" className="text-xs">
                    {cat.name} ({cat.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Range */}
      <div className="text-xs text-muted-foreground">
        Showing data from{' '}
        <span className="font-medium">
          {format(new Date(digest.dateRange.from), 'MMM d, yyyy')}
        </span>
        {' '}to{' '}
        <span className="font-medium">
          {format(new Date(digest.dateRange.to), 'MMM d, yyyy')}
        </span>
        {' '}<span className="text-muted-foreground/50">(generated {format(new Date(digest.generatedAt), 'MMM d, yyyy \'at\' h:mm a')})</span>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {digest.sections.map((section, index) => (
          <Card key={index} className="glass-effect">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
                {section.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {section.description}
              </p>
            </CardHeader>
            <CardContent>
              {section.items.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 py-4 text-center">
                  No items
                </p>
              ) : (
                <div className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={`${index}-${itemIndex}`}
                      className="flex items-start justify-between rounded-lg border border-border/20 p-2.5"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.subtitle}
                          </div>
                        )}
                        {item.date && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.date), 'MMM d, h:mm a')}
                          </div>
                        )}
                        {item.estimate && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            ~{item.estimate} min
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
