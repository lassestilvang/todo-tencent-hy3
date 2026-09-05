'use client'

import { useState, useMemo } from 'react'
import {
  Calendar,
  Brain,
  Zap,
  Sun,
  Moon,
  Star,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { batchPrioritize, suggestOptimalTime, type UserContext } from '@/lib/ai/task-prioritizer'
import { getUserPatterns, predictCompletionTime } from '@/lib/ai/patterns'
import type { Task } from '@/types'
import { toast } from 'sonner'

interface SmartSchedulerProps {
  tasks: Task[]
  onSchedule?: (taskId: string, time: string) => void
}

interface TimeSlot {
  hour: number
  label: string
  energy: 'high' | 'medium' | 'low'
  tasks: Task[]
}

interface ScheduledTask {
  task: Task
  scheduledTime: string
  priority: number
  predictedMinutes: number
}

export function SmartScheduler({ tasks, onSchedule }: SmartSchedulerProps) {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [showScheduler, setShowScheduler] = useState(false)
  const [workingHours, setWorkingHours] = useState({ start: 9, end: 17 })
  const [focusMode, setFocusMode] = useState(false)
  const [breakDuration, setBreakDuration] = useState(15)

  // Generate time slots based on working hours
  const timeSlots = useMemo(() => {
    const slots: TimeSlot[] = []
    for (let h = workingHours.start; h < workingHours.end; h++) {
      let energy: 'high' | 'medium' | 'low' = 'medium'
      if (h >= 9 && h <= 11) energy = 'high'
      else if (h >= 13 && h <= 15) energy = 'medium'
      else energy = 'low'

      slots.push({
        hour: h,
        label: `${h}:00 - ${h + 1}:00`,
        energy,
        tasks: [],
      })
    }
    return slots
  }, [workingHours])

  // Derive a real UserContext from the user's learned energy/pattern data
  // instead of a hardcoded stub. Falls back to sensible defaults when
  // no history is available.
  const buildUserContext = (): UserContext => {
    const patterns = getUserPatterns()

    // Infer energy level from the current hour and learned peak hours.
    const hour = new Date().getHours()
    const peakHours = patterns.workPatterns.peakEnergyHours
    const isPeak = peakHours.includes(hour)
    const energyLevel: UserContext['energyLevel'] = isPeak
      ? 'high'
      : peakHours.includes(hour - 2) || peakHours.includes(hour + 2)
        ? 'medium'
        : 'low'

    return {
      energyLevel,
      availableTimeMinutes: (workingHours.end - workingHours.start) * 60,
      focusMode: false,
      workHoursStart: workingHours.start,
      workHoursEnd: workingHours.end,
      productivityHistory: patterns.completedTasks?.map(t => ({
        date: t.date,
        taskCount: 1,
      })),
    }
  }

  // Auto-schedule incomplete tasks
  const autoSchedule = async () => {
    const incomplete = tasks.filter(t => !t.completed && !t.deadline)
    if (incomplete.length === 0) {
      toast.info('No unscheduled tasks to schedule')
      return
    }

    const context = buildUserContext()

    const prioritized = await batchPrioritize(incomplete, context)
    const scheduled: ScheduledTask[] = []
    let currentHour = workingHours.start
    let currentMinute = 0

    for (const { task, priority } of prioritized) {
      // Schedule against the learned duration rather than the raw
      // estimate, so the plan reflects how long tasks actually take.
      const estimate = predictCompletionTime(task).predictedMinutes
      const endTime = currentHour * 60 + currentMinute + estimate

      // Check if we have enough time in current slot
      if (endTime > workingHours.end * 60) {
        // Move to next available slot
        currentHour = workingHours.start
        currentMinute = 0
      }

      const scheduledTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`

      scheduled.push({
        task,
        scheduledTime,
        priority: priority.score,
        predictedMinutes: estimate,
      })

      // Advance time
      currentMinute += estimate + breakDuration
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60)
        currentMinute = currentMinute % 60
      }
    }

    setScheduledTasks(scheduled)
    toast.success(`Auto-scheduled ${scheduled.length} tasks!`)

    // Apply to tasks if callback provided
    scheduled.forEach(({ task, scheduledTime }) => {
      if (onSchedule) {
        const [hour, minute] = scheduledTime.split(':').map(Number)
        const date = new Date()
        date.setHours(hour, minute, 0, 0)
        onSchedule(task.id, date.toISOString())
      }
    })
  }

  const clearSchedule = () => {
    setScheduledTasks([])
  }

  const addManualTask = (task: Task) => {
    const context = buildUserContext()
    const optimalTime = suggestOptimalTime(task, context) || '10:00'
    const prediction = predictCompletionTime(task)

    setScheduledTasks(prev => [
      ...prev,
      {
        task,
        scheduledTime: optimalTime,
        priority: 50,
        predictedMinutes: prediction.predictedMinutes,
      },
    ])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Smart Scheduler</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered optimal task scheduling
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={showScheduler ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowScheduler(!showScheduler)}
            className="gap-1"
          >
            <Calendar className="h-4 w-4" />
            {showScheduler ? 'Hide' : 'Show'} Scheduler
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSchedule}
            disabled={scheduledTasks.length === 0}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 bg-muted/30 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <label className="text-xs">Work Hours</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={workingHours.start}
                  onChange={e => setWorkingHours(prev => ({ ...prev, start: Number(e.target.value) }))}
                  className="w-16 px-2 py-1 border rounded text-sm"
                />
                <span>to</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={workingHours.end}
                  onChange={e => setWorkingHours(prev => ({ ...prev, end: Number(e.target.value) }))}
                  className="w-16 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs">Break Duration</label>
              <input
                type="number"
                min="0"
                max="60"
                value={breakDuration}
                onChange={e => setBreakDuration(Number(e.target.value))}
                className="w-20 px-2 py-1 border rounded text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs">Focus Mode</label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={focusMode}
                  onChange={e => setFocusMode(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">90min blocks</span>
              </label>
            </div>
          </div>

          <Button onClick={autoSchedule} className="gap-1">
            <Zap className="h-4 w-4" />
            Auto Schedule
          </Button>
        </div>
      </div>

      {/* Scheduler View */}
      {showScheduler && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center justify-between">
              <span>Today&rsquo;s Schedule</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sun className="h-3 w-3 text-yellow-500" /> High Energy
                  <span className="mx-2">·</span>
                  <Star className="h-3 w-3 text-blue-500" /> Medium
                  <span className="mx-2">·</span>
                  <Moon className="h-3 w-3 text-purple-500" /> Low
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
              {timeSlots.map((slot) => {
                const slotTasks = scheduledTasks
                  .filter(t => {
                    const taskHour = parseInt(t.scheduledTime.split(':')[0])
                    return taskHour === slot.hour
                  })
                  .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

                return (
                  <div
                    key={slot.hour}
                    className={cn(
                      'p-3 rounded-lg border relative',
                      slot.energy === 'high' && 'bg-yellow-50 border-yellow-200',
                      slot.energy === 'medium' && 'bg-blue-50 border-blue-200',
                      slot.energy === 'low' && 'bg-purple-50 border-purple-200'
                    )}
                  >
                    <div className="font-medium text-sm">{slot.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {slotTasks.length} tasks
                    </div>
                    {slotTasks.map((st, index) => {
                      const prediction = predictCompletionTime(st.task)
                      const confidenceColor =
                        prediction.confidence === 'high' ? 'text-green-500'
                          : prediction.confidence === 'medium' ? 'text-amber-500'
                          : 'text-red-400'
                      return (
                        <div
                          key={index}
                          className="text-xs bg-white rounded px-1 py-0.5 mt-1 truncate"
                          title={`${st.task.name} · predicted ${st.predictedMinutes} min (${prediction.confidence})`}
                        >
                          {st.task.name}
                          <span className="text-muted-foreground ml-1">
                            ·{st.predictedMinutes}m
                          </span>
                          <span className={`ml-1 font-medium ${confidenceColor}`}>
                            ●
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual task addition */}
      {tasks.length > 0 && !showScheduler && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Add Manual Tasks</h4>
          <div className="flex flex-wrap gap-2">
            {tasks.filter(t => !t.completed).slice(0, 6).map(task => (
              <Button
                key={task.id}
                variant="outline"
                size="sm"
                onClick={() => addManualTask(task)}
                className="text-xs h-8"
              >
                {task.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}