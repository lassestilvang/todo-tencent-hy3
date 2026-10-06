'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  X,
  Volume2,
  VolumeX,
  Coffee,
  Zap,
  Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useKeyPress } from '@/lib/hooks'
import {
  adaptPomodoroDuration,
  MIN_SESSIONS_FOR_ADJUSTMENT,
  POMODORO_DURATION_STEPS,
} from '@/lib/focus/adaptive-pomodoro'
import { recordFocusSession } from '@/lib/focus/session-log'
import { enterFocusMode, exitFocusMode } from '@/lib/focus-mode-store'
import { toISODate } from '@/lib/focus/habit-metrics'
import { toast } from 'sonner'

type TimerMode = 'pomodoro' | 'shortBreak' | 'longBreak'
type TimerStatus = 'idle' | 'running' | 'paused'

interface FocusModeProps {
  _taskId?: string
  taskName?: string
  onClose: () => void
}

const DURATIONS = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

const MODE_LABELS: Record<TimerMode, string> = {
  pomodoro: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
}

const MODE_ICONS: Record<TimerMode, React.ReactNode> = {
  pomodoro: <Zap className="h-6 w-6" />,
  shortBreak: <Coffee className="h-6 w-6" />,
  longBreak: <Moon className="h-6 w-6" />,
}

const defaultSettings = {
  pomodoroDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartPomodoros: false,
  soundEnabled: true,
  notificationsEnabled: true,
  volume: 0.5,
}

function loadSettings() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('focus-mode-settings')
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) }
      } catch (e) {
        console.error('Failed to parse focus mode settings:', e)
        return defaultSettings
      }
    }
  }
  return defaultSettings
}

function loadStats() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('focus-mode-stats')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse focus mode stats:', e)
        return null
      }
    }
  }
  return { sessionsCompleted: 0, totalFocusTime: 0, sessionsAbandoned: 0 }
}

export function FocusMode({ _taskId, taskName, onClose }: FocusModeProps) {
  // Signal focus mode to the global DND store
  useEffect(() => {
    enterFocusMode()
    return () => exitFocusMode()
  }, [])

  const [mode, setMode] = useState<TimerMode>('pomodoro')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [timeRemaining, setTimeRemaining] = useState(DURATIONS.pomodoro)
  const [settings, setSettings] = useState(loadSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Stats are read from localStorage exactly once. A lazy initializer avoids the
  // setState-in-effect cascade that an effect on mount would cause.
  const [initialStats] = useState(loadStats)
  const [sessionsCompleted, setSessionsCompletedState] = useState(
    initialStats.sessionsCompleted || 0
  )
  const [totalFocusTime, setTotalFocusTimeState] = useState(
    initialStats.totalFocusTime || 0
  )
  const [sessionsAbandoned, setSessionsAbandonedState] = useState(
    initialStats.sessionsAbandoned || 0
  )

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<{
    play: () => Promise<void>
    gainNode?: GainNode
  } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const settingsRef = useRef(settings)
  const handleTimerCompleteRef = useRef<() => void | undefined>(undefined)
  const startTimeRef = useRef<number | null>(null)
  const durationRef = useRef<number>(DURATIONS.pomodoro)

  // Keep refs in sync
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // Initialize audio with generated tone using Web Audio API
  useEffect(() => {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const audioContext = new AudioContextClass()
    audioContextRef.current = audioContext

    // Create a reusable gain node for volume control
    const gainNode = audioContext.createGain()
    gainNode.connect(audioContext.destination)
    gainNode.gain.value = settingsRef.current.volume * 0.3

    audioRef.current = {
      play: async () => {
        // Create a new oscillator each time for clean playback
        const oscillator = audioContext.createOscillator()
        oscillator.connect(gainNode)
        oscillator.frequency.value = 800
        oscillator.type = 'sine'
        oscillator.start()
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            oscillator.stop()
            resolve()
          }, 300)
        })
      },
      gainNode,
    }

    return () => {
      audioContext.close()
    }
  }, [])

  // Timer logic - defined before useKeyPress hooks
  const tick = useCallback(() => {
    if (startTimeRef.current === null) return
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    const remaining = Math.max(0, durationRef.current - elapsed)

    setTimeRemaining(remaining)
    if (remaining <= 0) {
      handleTimerCompleteRef.current?.()
    }
  }, [])

  const pauseTimer = useCallback(() => {
    setStatus('paused')
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    startTimeRef.current = null
  }, [])

  const startTimer = useCallback(() => {
    setStatus('running')
    startTimeRef.current = Date.now()
    // Update immediately then every second
    tick()
    intervalRef.current = setInterval(tick, 1000)
  }, [tick])

  const resetTimer = useCallback(() => {
    pauseTimer()
    setStatus('idle')
    startTimeRef.current = null
    durationRef.current =
      DURATIONS[mode] *
      (mode === 'pomodoro' ? settings.pomodoroDuration / 25 : 1)
    setTimeRemaining(durationRef.current)
  }, [mode, settings, pauseTimer])

  // Resetting a focus session that was in progress counts as
  // abandoned, which feeds the adaptive duration and analytics.
  const abandonTimer = useCallback(() => {
    if (status !== 'idle' && mode === 'pomodoro') {
      setSessionsAbandonedState((prev: number) => prev + 1)
      // Minutes spent so far; a paused session has no start
      // reference, so it logs as zero.
      const elapsedMinutes =
        startTimeRef.current !== null
          ? Math.floor((Date.now() - startTimeRef.current) / 60000)
          : 0
      recordFocusSession({
        date: toISODate(new Date()),
        durationMinutes: elapsedMinutes,
        completed: false,
      })
    }
    resetTimer()
  }, [status, mode, resetTimer])

  const handleTimerComplete = useCallback(() => {
    pauseTimer()

    // Play sound
    if (settingsRef.current.soundEnabled && audioRef.current) {
      audioRef.current.play().catch((e) => {
        console.error('Failed to play audio:', e)
      })
    }

    // Show notification
    if (settingsRef.current.notificationsEnabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Focus Mode', {
          body: `${MODE_LABELS[mode]} complete!`,
          icon: '/icon-192.png',
        })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission()
      }
    }

    toast.success(`${MODE_LABELS[mode]} complete!`)

    if (mode === 'pomodoro') {
      const completed = sessionsCompleted + 1
      setSessionsCompletedState(completed)
      setTotalFocusTimeState(
        (prev: number) => prev + settingsRef.current.pomodoroDuration * 60
      )

      // Log the session for the habit metrics and focus analytics.
      recordFocusSession({
        date: toISODate(new Date()),
        durationMinutes: settingsRef.current.pomodoroDuration,
        completed: true,
      })

      // Adapt the focus duration to how sustainable it has been.
      const adaptation = adaptPomodoroDuration({
        sessionsCompleted: completed,
        sessionsAbandoned,
        pomodoroDuration: settingsRef.current.pomodoroDuration,
      })
      if (adaptation.changed) {
        setSettings((s: typeof settings) => ({
          ...s,
          pomodoroDuration: adaptation.pomodoroDuration,
        }))
        toast.info(
          `Focus duration adapted to ${adaptation.pomodoroDuration} min`,
          {
            description:
              adaptation.reason === 'improving'
                ? 'Sessions keep finishing — trying a longer focus block'
                : 'Sessions keep being abandoned — trying a shorter focus block',
          }
        )
      }

      // Determine next break
      const nextMode =
        completed >= (settingsRef.current.sessionsUntilLongBreak || 4)
          ? 'longBreak'
          : 'shortBreak'
      setMode(nextMode)

      if (settingsRef.current.autoStartBreaks) {
        setTimeout(() => startTimer(), 1000)
      }
    } else {
      // Break complete, back to pomodoro
      setMode('pomodoro')
      if (settingsRef.current.autoStartPomodoros) {
        setTimeout(() => startTimer(), 1000)
      }
    }
  }, [mode, sessionsCompleted, sessionsAbandoned, pauseTimer, startTimer])

  // Keep handleTimerCompleteRef in sync
  useEffect(() => {
    handleTimerCompleteRef.current = handleTimerComplete
  }, [handleTimerComplete])

  const handleModeChange = useCallback(
    (newMode: TimerMode) => {
      setMode(newMode)
      resetTimer()
    },
    [resetTimer]
  )

  // Keyboard shortcuts
  useKeyPress(['Space'], () => {
    if (status === 'running') {
      pauseTimer()
    } else if (status === 'paused' || status === 'idle') {
      startTimer()
    }
  })

  useKeyPress(['Escape'], () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
    } else {
      onClose()
    }
  })

  // Save settings
  useEffect(() => {
    localStorage.setItem('focus-mode-settings', JSON.stringify(settings))
    // Update duration ref based on settings
    durationRef.current = {
      pomodoro: settings.pomodoroDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    }[mode]
    if (status === 'idle') {
      setTimeRemaining(durationRef.current)
    }
  }, [settings, status, mode])

  // Save stats
  useEffect(() => {
    localStorage.setItem(
      'focus-mode-stats',
      JSON.stringify({
        sessionsCompleted: sessionsCompleted,
        totalFocusTime,
        sessionsAbandoned: sessionsAbandoned,
      })
    )
  }, [sessionsCompleted, totalFocusTime, sessionsAbandoned])

  // Update audio volume when settings change
  useEffect(() => {
    if (audioRef.current?.gainNode) {
      audioRef.current.gainNode.gain.value = settingsRef.current.soundEnabled
        ? settingsRef.current.volume * 0.3
        : 0
    }
  }, [settings.volume, settings.soundEnabled])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress =
    1 -
    timeRemaining /
      (DURATIONS[mode] *
        (mode === 'pomodoro' ? settings.pomodoroDuration / 25 : 1))

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Focus Mode</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogDescription className="text-sm">
            {taskName ? `Focusing on: ${taskName}` : 'Start a focus session'}
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="mb-6 flex gap-2">
          {(['pomodoro', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'outline'}
              className="flex flex-1 items-center gap-2"
              onClick={() => handleModeChange(m)}
            >
              {MODE_ICONS[m]}
              <span className="text-xs">{MODE_LABELS[m]}</span>
            </Button>
          ))}
        </div>

        {/* Timer Display */}
        <div className="relative mb-6">
          <svg className="mx-auto h-48 w-48 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/20"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={283}
              strokeDashoffset={283 * progress}
              strokeLinecap="round"
              className={cn(
                'transition-all duration-1000 ease-linear',
                mode === 'pomodoro' && 'text-primary',
                mode === 'shortBreak' && 'text-green-500',
                mode === 'longBreak' && 'text-blue-500'
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-5xl tabular-nums">
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={abandonTimer}
            disabled={status === 'idle'}
            aria-label="Reset timer"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            className="h-16 w-16"
            onClick={status === 'running' ? pauseTimer : startTimer}
          >
            {status === 'running' ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const nextMode =
                mode === 'pomodoro'
                  ? 'shortBreak'
                  : mode === 'shortBreak'
                    ? 'longBreak'
                    : 'pomodoro'
              handleModeChange(nextMode)
            }}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>

        {/* Stats */}
        <div className="bg-muted/50 mb-6 grid grid-cols-3 gap-4 rounded-lg p-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{sessionsCompleted}</p>
            <p className="text-muted-foreground text-xs">Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {Math.floor(totalFocusTime / 60)}m
            </p>
            <p className="text-muted-foreground text-xs">Focus Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {sessionsCompleted + sessionsAbandoned > 0
                ? Math.round(
                    (sessionsCompleted /
                      (sessionsCompleted + sessionsAbandoned)) *
                      100
                  )
                : 100}
              %
            </p>
            <p className="text-muted-foreground text-xs">Completion</p>
          </div>
        </div>

        {/* Volume Control */}
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setSettings((s: typeof settings) => ({
                ...s,
                soundEnabled: !s.soundEnabled,
              }))
            }
          >
            {settings.soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[settings.volume * 100]}
            onValueChange={([v]: number[]) =>
              setSettings((s: typeof settings) => ({ ...s, volume: v / 100 }))
            }
            max={100}
            step={10}
            className="flex-1"
          />
        </div>
      </DialogContent>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Focus Mode Settings</DialogTitle>
            <DialogDescription>
              Customize your focus sessions and breaks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Focus Duration (min)</Label>
                <Select
                  value={String(settings.pomodoroDuration)}
                  onValueChange={(v) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      pomodoroDuration: Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POMODORO_DURATION_STEPS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Adapts automatically after {MIN_SESSIONS_FOR_ADJUSTMENT}{' '}
                  sessions
                </p>
              </div>
              <div className="space-y-2">
                <Label>Short Break (min)</Label>
                <Select
                  value={String(settings.shortBreakDuration)}
                  onValueChange={(v) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      shortBreakDuration: Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 10, 15].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Long Break (min)</Label>
                <Select
                  value={String(settings.longBreakDuration)}
                  onValueChange={(v) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      longBreakDuration: Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 30].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sessions until Long Break</Label>
                <Select
                  value={String(settings.sessionsUntilLongBreak || 4)}
                  onValueChange={(v) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      sessionsUntilLongBreak: Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5].map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s} sessions
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-start breaks</p>
                  <p className="text-muted-foreground text-sm">
                    Automatically start break after focus session
                  </p>
                </div>
                <Switch
                  checked={settings.autoStartBreaks}
                  onCheckedChange={(c: boolean) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      autoStartBreaks: c,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-start focus sessions</p>
                  <p className="text-muted-foreground text-sm">
                    Automatically start next focus after break
                  </p>
                </div>
                <Switch
                  checked={settings.autoStartPomodoros}
                  onCheckedChange={(c: boolean) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      autoStartPomodoros: c,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sound notifications</p>
                  <p className="text-muted-foreground text-sm">
                    Play sound when timer completes
                  </p>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(c: boolean) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      soundEnabled: c,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Browser notifications</p>
                  <p className="text-muted-foreground text-sm">
                    Show system notification when timer completes
                  </p>
                </div>
                <Switch
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(c: boolean) =>
                    setSettings((s: typeof settings) => ({
                      ...s,
                      notificationsEnabled: c,
                    }))
                  }
                />
              </div>
            </div>

            <Button className="w-full" onClick={() => setIsSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
