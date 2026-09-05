'use client'

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { Clock, Zap, CheckCircle2, CircleDashed } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { batchPrioritize, type UserContext } from '@/lib/ai/task-prioritizer'
import { getUserPatterns, predictCompletionTime } from '@/lib/ai/patterns'
import { useTasks } from '@/lib/tasks-client'
import { updateTask } from '@/lib/tasks'
import type { Task } from '@/types'

interface TimeBlockViewProps {
  initialTasks?: Task[]
}

interface ScheduledTask {
  task: Task
  startTime: number // minutes from midnight
  duration: number
}

const WORK_HOURS_START = 8  // 8 AM
const WORK_HOURS_END = 18   // 6 PM
const SLOT_INTERVAL = 30    // 30-minute slots

function getCurrentDay(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function TimeBlockView({ initialTasks }: TimeBlockViewProps) {
  const { data: fetchedTasks } = useTasks({ view: 'today' })
  const allTasks = initialTasks ?? fetchedTasks ?? []

  const [selectedDate, setSelectedDate] = useState<Date>(getCurrentDay())
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  // Filter to today's incomplete tasks
  const availableTasks = useMemo(() => {
    return allTasks.filter(t => !t.completed)
  }, [allTasks])

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots: number[] = []
    for (let m = WORK_HOURS_START * 60; m <= WORK_HOURS_END * 60; m += SLOT_INTERVAL) {
      slots.push(m)
    }
    return slots
  }, [])

  // Auto-schedule using AI
  const autoSchedule = useCallback(async () => {
    if (availableTasks.length === 0) {
      toast.info('No tasks to schedule')
      return
    }

    const patterns = getUserPatterns()
    const hour = new Date().getHours()
    const peakHours = patterns.workPatterns.peakEnergyHours
    const energyLevel: UserContext['energyLevel'] = peakHours.includes(hour)
      ? 'high'
      : peakHours.includes(hour - 2) || peakHours.includes(hour + 2)
        ? 'medium'
        : 'low'

    const context: UserContext = {
      energyLevel,
      availableTimeMinutes: (WORK_HOURS_END - WORK_HOURS_START) * 60,
      workHoursStart: WORK_HOURS_START,
      workHoursEnd: WORK_HOURS_END,
      productivityHistory: patterns.completedTasks?.map(t => ({
        date: t.date,
        taskCount: 1,
      })),
    }

    const prioritized = await batchPrioritize(availableTasks, context)
    const scheduled: ScheduledTask[] = []
    let currentMinute = WORK_HOURS_START * 60

    for (const { task, priority } of prioritized) {
      const prediction = predictCompletionTime(task)
      const duration = prediction.predictedMinutes

      // Check if task fits before end of work day
      if (currentMinute + duration > WORK_HOURS_END * 60) {
        // Wrap to next day or skip if it doesn't fit
        currentMinute = WORK_HOURS_START * 60
      }

      // Skip if this slot is already taken by another task
      const overlaps = scheduledTasks.some(s =>
        currentMinute < s.startTime + s.duration &&
        currentMinute + duration > s.startTime
      )

      if (!overlaps) {
        scheduled.push({
          task,
          startTime: currentMinute,
          duration,
        })
      }

      currentMinute += duration + 15 // 15 min break between tasks
    }

    setScheduledTasks(scheduled)
    toast.success(`Scheduled ${scheduled.length} tasks automatically`)

    // Apply scheduled times to tasks
    for (const { task, startTime } of scheduled) {
      const date = new Date(selectedDate)
      date.setHours(0, startTime, 0, 0)
      try {
        await updateTask(task.id, {
          deadline: date.toISOString(),
        })
      } catch (error) {
        console.error('Failed to update task deadline:', error)
      }
    }
  }, [availableTasks, selectedDate, scheduledTasks])

  // Place a task into a time slot
  const placeTask = useCallback((task: Task, slotStart: number) => {
    const prediction = predictCompletionTime(task)
    setScheduledTasks(prev => {
      // Remove existing entry for this task
      const filtered = prev.filter(s => s.task.id !== task.id)
      return [...filtered, {
        task,
        startTime: slotStart,
        duration: prediction.predictedMinutes,
      }]
    })
  }, [])

  // Get tasks scheduled in a time slot
  const getTasksAtSlot = (slotStart: number) => {
    const slotEnd = slotStart + SLOT_INTERVAL
    return scheduledTasks.filter(s =>
      s.startTime < slotEnd && s.startTime + s.duration > slotStart
    ).sort((a, b) => a.startTime - b.startTime)
  }

  // Get tasks not yet scheduled
  const getUnscheduledTasks = () => {
    const scheduledIds = new Set(scheduledTasks.map(s => s.task.id))
    return availableTasks.filter(t => !scheduledIds.has(t.id))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Time Blocking</h2>
          <p className="text-sm text-muted-foreground">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const d = new Date(selectedDate)
            d.setDate(d.getDate() - 1)
            setSelectedDate(d)
          }}>
            ←
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const d = new Date(selectedDate)
            d.setDate(d.getDate() + 1)
            setSelectedDate(d)
          }}>
            →
          </Button>
          <Button variant="secondary" size="sm" onClick={autoSchedule}>
            <Zap className="h-4 w-4 mr-1" />
            Auto-Schedule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Unscheduled tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {getUnscheduledTasks().length === 0 ? (
                <p className="text-xs text-muted-foreground">All tasks scheduled!</p>
              ) : (
                getUnscheduledTasks().map(task => {
                  const prediction = predictCompletionTime(task)
                  return (
                    <div
                      key={task.id}
                      className="p-2 rounded-lg border bg-background cursor-grab hover:shadow-md transition-shadow"
                      draggable
                      onDragStart={(e) => {
                        setDraggedTask(task)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDraggedTask(null)}
                    >
                      <div className="flex items-start gap-2">
                        <CircleDashed className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{task.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ~{prediction.predictedMinutes} min
                            {prediction.confidence === 'high' && ' ✓'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Day Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Current time indicator */}
                {format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                  <div
                    className="absolute left-0 w-full border-t-2 border-red-500 z-10"
                    style={{ top: `${(new Date().getHours() * 60 + new Date().getMinutes() - WORK_HOURS_START * 60) / ((WORK_HOURS_END - WORK_HOURS_START) * 60) * 100}%` }}
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1 -mt-1" />
                  </div>
                )}

                <div className="space-y-0">
                  {timeSlots.map((slot) => {
                    const slotTasks = getTasksAtSlot(slot)
                    const isCurrentHour = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') &&
                      slot === Math.floor(new Date().getHours() * 60 / SLOT_INTERVAL) * SLOT_INTERVAL

                    return (
                      <div
                        key={slot}
                        className={`border-b relative transition-colors ${
                          isCurrentHour ? 'bg-red-50 dark:bg-red-950/30' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (draggedTask) {
                            placeTask(draggedTask, slot)
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {minutesToTimeString(slot)}
                        </div>

                        <div className="px-3 pb-1">
                          {slotTasks.map(({ task, startTime, duration }) => {
                            const prediction = predictCompletionTime(task)
                            return (
                              <div
                                key={`${task.id}-${startTime}`}
                                className="mb-1 p-2 rounded-lg bg-primary/10 border border-primary/20 text-sm"
                                style={{
                                  marginLeft: '2px',
                                  marginRight: '2px',
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                  <span className="font-medium">{task.name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {minutesToTimeString(startTime)} – {minutesToTimeString(startTime + duration)}
                                  {' · ~' + prediction.predictedMinutes + 'm'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
