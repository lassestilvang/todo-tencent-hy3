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
  Bell,
  Coffee,
  Zap,
  Sun,
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
import { toast } from 'sonner'

type TimerMode = 'pomodoro' | 'shortBreak' | 'longBreak'
type TimerStatus = 'idle' | 'running' | 'paused'

interface FocusModeProps {
  taskId?: string
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

export function FocusMode({ taskId, taskName, onClose }: FocusModeProps) {
  const [mode, setMode] = useState<TimerMode>('pomodoro')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [timeRemaining, setTimeRemaining] = useState(DURATIONS.pomodoro)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [totalFocusTime, setTotalFocusTime] = useState(0)
  const [settings, setSettings] = useState({
    pomodoroDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    autoStartBreaks: true,
    autoStartPomodoros: false,
    soundEnabled: true,
    notificationsEnabled: true,
    volume: 0.5,
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<{ play: () => Promise<void>; gainNode?: GainNode } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize audio with generated tone using Web Audio API
  useEffect(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    // Create a reusable gain node for volume control
    const gainNode = audioContext.createGain()
    gainNode.connect(audioContext.destination)
    gainNode.gain.value = settings.volume * 0.3

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

    // Load persisted settings
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('focus-mode-settings')
      if (saved) {
        try {
          setSettings(JSON.parse(saved))
          // Apply durations
          setTimeRemaining(DURATIONS[mode])
        } catch {}
      }

      const savedStats = localStorage.getItem('focus-mode-stats')
      if (savedStats) {
        try {
          const stats = JSON.parse(savedStats)
          setSessionsCompleted(stats.sessionsCompleted || 0)
          setTotalFocusTime(stats.totalFocusTime || 0)
        } catch {}
      }
    }
  }, [])

  // Save settings
  useEffect(() => {
    localStorage.setItem('focus-mode-settings', JSON.stringify(settings))
    // Update durations based on settings
    const newDurations = {
      pomodoro: settings.pomodoroDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    }
    if (status === 'idle') {
      setTimeRemaining(newDurations[mode])
    }
  }, [settings, status, mode])

  // Save stats
  useEffect(() => {
    localStorage.setItem(
      'focus-mode-stats',
      JSON.stringify({ sessionsCompleted, totalFocusTime })
    )
  }, [sessionsCompleted, totalFocusTime])

  // Update audio volume when settings change
  useEffect(() => {
    if (audioRef.current?.gainNode) {
      audioRef.current.gainNode.gain.value = settings.soundEnabled ? settings.volume * 0.3 : 0
    }
  }, [settings.volume, settings.soundEnabled])

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

  // Timer logic
  const tick = useCallback(() => {
    setTimeRemaining((prev) => {
      if (prev <= 1) {
        handleTimerComplete()
        return 0
      }
      return prev - 1
    })
  }, [])

  const startTimer = useCallback(() => {
    setStatus('running')
    intervalRef.current = setInterval(tick, 1000)
  }, [tick])

  const pauseTimer = useCallback(() => {
    setStatus('paused')
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const resetTimer = useCallback(() => {
    pauseTimer()
    setStatus('idle')
    setTimeRemaining(DURATIONS[mode] * (mode === 'pomodoro' ? settings.pomodoroDuration / 25 : 1))
  }, [mode, settings, pauseTimer])

  const handleTimerComplete = useCallback(() => {
    pauseTimer()

    // Play sound
    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {})
    }

    // Show notification
    if (settings.notificationsEnabled && 'Notification' in window) {
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
      setSessionsCompleted((prev) => prev + 1)
      setTotalFocusTime((prev) => prev + settings.pomodoroDuration * 60)

      // Determine next break
      const nextMode = sessionsCompleted + 1 >= 4 ? 'longBreak' : 'shortBreak'
      setMode(nextMode)

      if (settings.autoStartBreaks) {
        setTimeout(() => startTimer(), 1000)
      }
    } else {
      // Break complete, back to pomodoro
      setMode('pomodoro')
      if (settings.autoStartPomodoros) {
        setTimeout(() => startTimer(), 1000)
      }
    }
  }, [mode, sessionsCompleted, settings, pauseTimer, startTimer])

  const handleModeChange = useCallback((newMode: TimerMode) => {
    setMode(newMode)
    resetTimer()
  }, [resetTimer])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress = 1 - timeRemaining / (DURATIONS[mode] * (mode === 'pomodoro' ? settings.pomodoroDuration / 25 : 1))

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Focus Mode</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
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
        <div className="flex gap-2 mb-6">
          {(['pomodoro', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'outline'}
              className="flex-1 flex items-center gap-2"
              onClick={() => handleModeChange(m)}
            >
              {MODE_ICONS[m]}
              <span className="text-xs">{MODE_LABELS[m]}</span>
            </Button>
          ))}
        </div>

        {/* Timer Display */}
        <div className="relative mb-6">
          <svg className="w-48 h-48 mx-auto -rotate-90" viewBox="0 0 100 100">
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
            <span className="text-5xl font-mono tabular-nums">
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={resetTimer}
            disabled={status === 'idle'}
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
              const nextMode = mode === 'pomodoro' ? 'shortBreak' : mode === 'shortBreak' ? 'longBreak' : 'pomodoro'
              handleModeChange(nextMode)
            }}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold">{sessionsCompleted}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {Math.floor(totalFocusTime / 60)}m
            </p>
            <p className="text-xs text-muted-foreground">Focus Time</p>
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
          >
            {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Slider
            value={[settings.volume * 100]}
            onValueChange={([v]: number[]) => setSettings((s) => ({ ...s, volume: v / 100 }))}
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
                  onValueChange={(v) => setSettings((s) => ({ ...s, pomodoroDuration: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 20, 25, 30, 40, 50, 60].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Short Break (min)</Label>
                <Select
                  value={String(settings.shortBreakDuration)}
                  onValueChange={(v) => setSettings((s) => ({ ...s, shortBreakDuration: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 10, 15].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Long Break (min)</Label>
                <Select
                  value={String(settings.longBreakDuration)}
                  onValueChange={(v) => setSettings((s) => ({ ...s, longBreakDuration: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 30].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sessions until Long Break</Label>
                <Select
                  value="4"
                  onValueChange={() => {}}
                  disabled
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 sessions (fixed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-start breaks</p>
                  <p className="text-sm text-muted-foreground">Automatically start break after focus session</p>
                </div>
                <Switch
                  checked={settings.autoStartBreaks}
                  onCheckedChange={(c: boolean) => setSettings((s) => ({ ...s, autoStartBreaks: c }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-start focus sessions</p>
                  <p className="text-sm text-muted-foreground">Automatically start next focus after break</p>
                </div>
                <Switch
                  checked={settings.autoStartPomodoros}
                  onCheckedChange={(c: boolean) => setSettings((s) => ({ ...s, autoStartPomodoros: c }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sound notifications</p>
                  <p className="text-sm text-muted-foreground">Play sound when timer completes</p>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(c) => setSettings((s) => ({ ...s, soundEnabled: c }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Browser notifications</p>
                  <p className="text-sm text-muted-foreground">Show system notification when timer completes</p>
                </div>
                <Switch
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(c) => setSettings((s) => ({ ...s, notificationsEnabled: c }))}
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