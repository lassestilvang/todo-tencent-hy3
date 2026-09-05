'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pause, Play, SkipForward, X, Settings, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useTasks } from '@/lib/tasks-client'
import {
  FocusSession,
  BuddyPersonality,
  BuddyMessage,
  SessionPhase,
  generateBuddyMessage,
  recommendSessionDuration,
  getPersonalityDescription,
  loadBuddyPersonality,
  saveBuddyPersonality,
} from '@/lib/focus-buddy'
import type { Task } from '@/types'

interface FocusBuddyProps {
  defaultTaskId?: string
  autoStart?: boolean
}

/**
 * The FocusBuddy companion: a pomodoro-style focus timer with
 * an AI-powered "buddy" that provides real-time encouragement,
 * tips, and post-session analysis.
 *
 * Features:
 * - Configurable personalities (coach, drill-sergeant, zen, cheerleader)
 * - Task-aware messaging based on task name/description
 * - Auto-recommended session durations (25 or 50 min)
 * - Break management (short 5-min and long 15-min breaks)
 * - Session history and post-session analysis
 */
export function FocusBuddy({ defaultTaskId, autoStart = false }: FocusBuddyProps) {
  const { data: allTasks } = useTasks({ view: 'all' })
  const [personality, setPersonality] = useState<BuddyPersonality>('coach')
  const [session, setSession] = useState<FocusSession | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(defaultTaskId || null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const messageTimerRef = useRef<NodeJS.Timeout | null>(null)

  const selectedTask = allTasks?.find((t) => t.id === selectedTaskId)

  // Load personality from localStorage on mount
  useEffect(() => {
    setPersonality(loadBuddyPersonality())
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    }
  }, [])

  const startSession = (taskId?: string) => {
    const task = (taskId ? allTasks?.find((t) => t.id === taskId) : selectedTask) || undefined
    const duration = recommendSessionDuration(task)

    const newSession: FocusSession = {
      id: `session-${Date.now()}`,
      taskId: task?.id || null,
      taskName: task?.name,
      startTime: Date.now(),
      plannedDuration: duration,
      actualDuration: null,
      phase: 'preparing',
      completed: false,
      pausedAt: null,
      totalPauseDuration: 0,
      buddyMessages: [],
      startingEnergy: 3,
    }

    setSession(newSession)

    // Initial "preparing" message, then start working after 3 seconds
    setTimeout(() => {
      setSession((prev) => {
        if (!prev) return prev
        const msg = generateBuddyMessage(prev, personality, task)
        return {
          ...prev,
          phase: 'working',
          buddyMessages: [...prev.buddyMessages, msg],
        }
      })
    }, 3000)

    // Schedule periodic buddy messages during work sessions
    const messageInterval = setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.phase !== 'working') return prev
        const elapsed = Date.now() - prev.startTime
        const elapsedMin = elapsed / 60000
        const msg = generateBuddyMessage(prev, personality, task, elapsedMin, duration)
        return {
          ...prev,
          buddyMessages: [...prev.buddyMessages, msg],
        }
      })
    }, 60000) // Message every minute

    messageTimerRef.current = messageInterval as any
  }

  const togglePause = () => {
    if (!session) return

    setSession((prev) => {
      if (!prev) return prev
      if (prev.pausedAt !== null) {
        // Resuming
        const pauseDuration = Date.now() - prev.pausedAt
        return {
          ...prev,
          pausedAt: null,
          totalPauseDuration: prev.totalPauseDuration + pauseDuration,
        }
      } else {
        // Pausing
        return {
          ...prev,
          pausedAt: Date.now(),
        }
      }
    })
  }

  const skipPhase = () => {
    if (!session) return

    setSession((prev) => {
      if (!prev) return prev

      let nextPhase: SessionPhase = prev.phase
      let actualDuration = prev.actualDuration

      switch (prev.phase) {
        case 'preparing':
          nextPhase = 'working'
          break
        case 'working':
          nextPhase = 'short-break'
          break
        case 'short-break':
          nextPhase = prev.completed ? 'completed' : 'working'
          // Start a new working session if not done
          if (!prev.completed) {
            setTimeout(() => startSession(undefined), 0) // Start new session
          } else {
            nextPhase = 'completed'
          }
          break
        case 'long-break':
          nextPhase = 'completed'
          break
        default:
          nextPhase = prev.phase
      }

      if (nextPhase === 'working' && prev.phase === 'short-break') {
        // Post-break message
        const task = allTasks?.find((t) => t.id === prev.taskId)
        const msg = generateBuddyMessage(
          { ...prev, phase: nextPhase },
          personality,
          task
        )
        return {
          ...prev,
          phase: nextPhase,
          buddyMessages: [...prev.buddyMessages, msg],
        }
      }

      if (nextPhase === 'completed') {
        actualDuration = prev.actualDuration ?? (prev.plannedDuration * 60 * 1000)
        const task = allTasks?.find((t) => t.id === prev.taskId)
        const msg = generateBuddyMessage(
          { ...prev, phase: nextPhase },
          personality,
          task
        )
        return {
          ...prev,
          phase: nextPhase,
          completed: true,
          actualDuration,
          buddyMessages: [...prev.buddyMessages, msg],
        }
      }

      return { ...prev, phase: nextPhase }
    })
  }

  const endSession = () => {
    if (!session) return
    // Stop timers
    if (timerRef.current) clearInterval(timerRef.current)
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    setSession(null)
  }

  const updatePersonality = (newPersonality: BuddyPersonality) => {
    setPersonality(newPersonality)
    saveBuddyPersonality(newPersonality)
    setIsSettingsOpen(false)
  }

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getElapsedTime = (): number => {
    if (!session) return 0
    if (session.pausedAt !== null) {
      return session.pausedAt - session.startTime - session.totalPauseDuration
    }
    return Date.now() - session.startTime - session.totalPauseDuration
  }

  const getProgress = (): number => {
    if (!session) return 0
    const elapsed = getElapsedTime()
    const planned = session.plannedDuration * 60 * 1000
    return Math.min(100, (elapsed / planned) * 100)
  }

  const getPhaseLabel = (): string => {
    if (!session) return ''
    switch (session.phase) {
      case 'preparing': return 'Get Ready'
      case 'working': return 'Focus Time'
      case 'short-break': return 'Short Break'
      case 'long-break': return 'Long Break'
      case 'completed': return 'Completed'
      default: return ''
    }
  }

  const getPhaseColor = (): string => {
    if (!session) return 'bg-muted'
    switch (session.phase) {
      case 'preparing': return 'bg-yellow-500/10 text-yellow-600'
      case 'working': return 'bg-blue-500/10 text-blue-600'
      case 'short-break': return 'bg-green-500/10 text-green-600'
      case 'long-break': return 'bg-purple-500/10 text-purple-600'
      case 'completed': return 'bg-indigo-500/10 text-indigo-600'
      default: return 'bg-muted'
    }
  }

  // Live timer update
  const [, forceUpdate] = useState({})
  useEffect(() => {
    if (!session || session.phase === 'completed') return

    const interval = setInterval(() => {
      forceUpdate({})
    }, 1000)

    timerRef.current = interval as any
    return () => clearInterval(interval)
  }, [session])

  if (!session) {
    return (
      <Card className="glass-effect">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              FocusBuddy
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Task</Label>
            <Select
              value={selectedTaskId || undefined}
              onValueChange={setSelectedTaskId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a task (optional)" />
              </SelectTrigger>
              <SelectContent>
                {allTasks
                  ?.filter((t) => !t.completed)
                  .map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              Your AI-powered focus companion. Choose a personality and start a session.
            </p>
            <p className="text-xs text-muted-foreground">
              Personality: <strong>{personality}</strong> — {getPersonalityDescription(personality)}
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => startSession(selectedTaskId || undefined)}
          >
            <Play className="h-5 w-5 mr-2" />
            Start Focus Session
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Active session view
  return (
    <>
      <Card className="glass-effect">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              FocusBuddy
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phase badge */}
          <div className="flex items-center justify-between">
            <Badge className={getPhaseColor()}>{getPhaseLabel()}</Badge>
            {selectedTask && (
              <Badge variant="outline">{selectedTask.name}</Badge>
            )}
          </div>

          {/* Timer */}
          <div className="text-center py-4">
            <div className="text-4xl font-mono font-bold">
              {formatTime(getElapsedTime())}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              of {session.plannedDuration}:00 planned
            </p>
          </div>

          {/* Progress */}
          <Progress value={getProgress()} className="h-2" />

          {/* Buddy messages */}
          <div className="max-h-40 overflow-y-auto space-y-2">
            {session.buddyMessages.map((msg) => (
              <BuddyMessageBubble key={msg.id} message={msg} />
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              variant={session.pausedAt !== null ? 'default' : 'outline'}
              size="sm"
              onClick={togglePause}
              disabled={session.phase === 'completed'}
            >
              {session.pausedAt !== null ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={skipPhase}
              disabled={session.phase === 'completed'}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={endSession}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Personality indicator */}
          <div className="text-xs text-muted-foreground">
            Buddy personality: {personality}
          </div>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>FocusBuddy Settings</DialogTitle>
            <DialogDescription>
              Choose how your FocusBuddy motivates you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Personality</Label>
              <Select value={personality} onValueChange={updatePersonality}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">Coach — Supportive & encouraging</SelectItem>
                  <SelectItem value="drill-sergeant">Drill Sergeant — Strict & disciplined</SelectItem>
                  <SelectItem value="zen">Zen — Calm & mindful</SelectItem>
                  <SelectItem value="cheerleader">Cheerleader — High-energy & enthusiastic</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {getPersonalityDescription(personality)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BuddyMessageBubble({ message }: { message: BuddyMessage }) {
  const bgColor = {
    encouragement: 'bg-blue-500/10 border-blue-500/20',
    tip: 'bg-green-500/10 border-green-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    celebration: 'bg-purple-500/10 border-purple-500/20',
    question: 'bg-pink-500/10 border-pink-500/20',
  }[message.type]

  const icon = {
    encouragement: '💪',
    tip: '💡',
    warning: '⚠️',
    celebration: '🎉',
    question: '🤔',
  }[message.type]

  return (
    <div className={`rounded-lg border p-3 text-sm ${bgColor}`}>
      <div className="flex gap-2">
        <span className="text-lg">{icon}</span>
        <p className="flex-1">{message.text}</p>
      </div>
      <div className="text-xs text-muted-foreground mt-1 opacity-70">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}
