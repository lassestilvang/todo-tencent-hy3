'use client'

import { useState, useMemo } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  History,
  GitBranch,
  GitCommit,
  Clock,
  User,
  Tag,
  Paperclip,
  Check,
  X,
  AlertCircle,
  Calendar,
  ListTodo,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PriorityIcon } from '@/components/priority-icon'
import type { Task } from '@/types'
import type { TimelineEntry } from '@/lib/tasks'
import { cn, formatDateTime } from '@/lib/utils'

interface TaskArcheologyViewProps {
  task: Task | undefined
  timeline: TimelineEntry[]
  logCount: number
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <GitCommit className="h-4 w-4 text-green-500" />,
  updated: <GitBranch className="h-4 w-4 text-blue-500" />,
  completed: <Check className="h-4 w-4 text-green-500" />,
  reopened: <AlertCircle className="h-4 w-4 text-amber-500" />,
  deleted: <X className="h-4 w-4 text-red-500" />,
  label_added: <Tag className="h-4 w-4 text-purple-500" />,
  label_removed: <Tag className="h-4 w-4 text-purple-500/50" />,
  attachment_added: <Paperclip className="h-4 w-4 text-indigo-500" />,
  attachment_removed: <Paperclip className="h-4 w-4 text-indigo-500/50" />,
  reminder_added: <Clock className="h-4 w-4 text-orange-500" />,
  reminder_sent: <Clock className="h-4 w-4 text-orange-500/50" />,
  recurring: <Calendar className="h-4 w-4 text-teal-500" />,
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-500',
  updated: 'bg-blue-500',
  completed: 'bg-green-500',
  reopened: 'bg-amber-500',
  deleted: 'bg-red-500',
  label_added: 'bg-purple-500',
  label_removed: 'bg-purple-400',
  attachment_added: 'bg-indigo-500',
  attachment_removed: 'bg-indigo-400',
  reminder_added: 'bg-orange-500',
  reminder_sent: 'bg-orange-400',
  recurring: 'bg-teal-500',
}

function getActionIcon(action: string): React.ReactNode {
  return ACTION_ICONS[action] ?? <History className="h-4 w-4 text-muted-foreground" />
}

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-muted'
}

export function TaskArcheologyView({ task, timeline, logCount }: TaskArcheologyViewProps) {
  const [filter, setFilter] = useState<'all' | 'updates' | 'status' | 'attachments' | 'labels'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTimeline = useMemo(() => {
    let result = timeline

    if (filter !== 'all') {
      const filterMap: Record<string, string[]> = {
        updates: ['updated'],
        status: ['completed', 'reopened', 'deleted'],
        attachments: ['attachment_added', 'attachment_removed'],
        labels: ['label_added', 'label_removed'],
      }
      const allowed = filterMap[filter] ?? []
      result = result.filter((entry) => allowed.includes(entry.action))
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((entry) =>
        entry.description.toLowerCase().includes(query) ||
        entry.action.toLowerCase().includes(query) ||
        entry.field?.toLowerCase().includes(query)
      )
    }

    return result
  }, [timeline, filter, searchQuery])

  const summary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of timeline) {
      counts[entry.action] = (counts[entry.action] || 0) + 1
    }
    return counts
  }, [timeline])

  return (
    <div className="space-y-8">
      {/* Task Overview Card */}
      {task ? (
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
              Task Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  task.completed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'
                )}>
                  <div className={cn(
                    'h-3 w-3 rounded-full',
                    task.completed ? 'bg-green-500' : 'bg-gray-400'
                  )} />
                </div>
                <div>
                  <h3 className={cn(
                    'text-lg font-semibold',
                    task.completed && 'line-through opacity-60'
                  )}>
                    {task.name}
                  </h3>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  )}
                </div>
              </div>
              <PriorityIcon priority={task.priority} />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {task.list && (
                <div className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {task.list.emoji} {task.list.name}
                  </span>
                </div>
              )}
              {task.deadline && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Due {format(new Date(task.deadline), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              {task.estimate && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{task.estimate} min estimate</span>
                </div>
              )}
              {task.actual_time > 0 && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{task.actual_time} min spent</span>
                </div>
              )}
            </div>

            {task.labels && task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map((l: { id: string; name: string; icon: string }) => (
                  <Badge
                    key={l.id}
                    variant="secondary"
                    className="border-border/10 border text-xs"
                  >
                    {l.icon} {l.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Created: {formatDateTime(task.created_at)}
              {' · '}
              Updated: {formatDateTime(task.updated_at)}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Task not found</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Bar */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">
          {logCount} total events
        </Badge>
        {Object.entries(summary).map(([action, count]) => (
          <Badge
            key={action}
            variant="secondary"
            className="text-xs"
          >
            {action}: {count}
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1.5">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All Events
          </Button>
          <Button
            variant={filter === 'updates' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('updates')}
          >
            Updates
          </Button>
          <Button
            variant={filter === 'status' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('status')}
          >
            Status Changes
          </Button>
          <Button
            variant={filter === 'attachments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('attachments')}
          >
            Attachments
          </Button>
          <Button
            variant={filter === 'labels' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('labels')}
          >
            Labels
          </Button>
        </div>

        {timeline.length > 0 && (
          <input
            type="text"
            placeholder="Search events..."
            className="flex-1 min-w-[150px] rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none ring-primary focus-within:ring-2"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        )}
      </div>

      {/* Timeline */}
      <Card className="glass-effect">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {filteredTimeline.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {timeline.length === 0
                  ? 'No history available for this task.'
                  : 'No events match your filter.'}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Vertical timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {filteredTimeline.map((entry, index) => {
                  const icon = getActionIcon(entry.action)
                  const colorClass = getActionColor(entry.action)

                  return (
                    <div key={`${entry.timestamp}-${entry.action}-${index}`} className="relative pl-12">
                      {/* Timeline dot */}
                      <div className="absolute left-0.5 top-0.5 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full',
                          colorClass,
                          'text-white'
                        )}>
                          {icon}
                        </div>
                      </div>

                      <div className={cn(
                        'rounded-lg border p-3',
                        'border-border/20 bg-accent/10'
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm">
                              {entry.description}
                            </div>
                            {entry.field && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Field: {entry.field}
                              </div>
                            )}
                            {entry.from !== undefined && entry.to !== undefined && (
                              <div className="mt-1.5 space-y-1">
                                <div className="text-xs">
                                  <span className="text-muted-foreground">From: </span>
                                  <code className="rounded bg-muted/20 px-1.5 py-0.5">
                                    {entry.from === null ? 'null' : String(entry.from)}
                                  </code>
                                </div>
                                <div className="text-xs">
                                  <span className="text-muted-foreground">To: </span>
                                  <code className="rounded bg-muted/20 px-1.5 py-0.5">
                                    {entry.to === null ? 'null' : String(entry.to)}
                                  </code>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge
                              variant="outline"
                              className="text-xs mb-1"
                            >
                              {entry.action}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(entry.timestamp), 'MMM d, yyyy \'at\' h:mm a')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
