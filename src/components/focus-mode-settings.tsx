'use client'

import { useState } from 'react'
import { Coffee, Moon, Zap, Volume2, VolumeX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const defaultSettings = {
  pomodoroDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
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
        console.error("Failed to parse focus mode settings:", e)
        return defaultSettings
      }
    }
  }
  return defaultSettings
}

export function FocusModeSettings() {
  const [settings, setSettings] = useState(loadSettings)

  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings((prev: typeof settings) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('focus-mode-settings', JSON.stringify(next))
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Focus Mode Settings
        </CardTitle>
        <CardDescription>
          Configure Pomodoro timer durations and behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duration Settings */}
        <div className="space-y-4">
          <h3 className="font-medium">Session Durations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pomodoro-duration">Focus Duration (minutes)</Label>
              <Select
                value={String(settings.pomodoroDuration)}
                onValueChange={(v) => updateSetting('pomodoroDuration', Number(v))}
              >
                <SelectTrigger id="pomodoro-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 20, 25, 30, 40, 50, 60].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="short-break-duration">Short Break (minutes)</Label>
              <Select
                value={String(settings.shortBreakDuration)}
                onValueChange={(v) => updateSetting('shortBreakDuration', Number(v))}
              >
                <SelectTrigger id="short-break-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 10, 15].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="long-break-duration">Long Break (minutes)</Label>
              <Select
                value={String(settings.longBreakDuration)}
                onValueChange={(v) => updateSetting('longBreakDuration', Number(v))}
              >
                <SelectTrigger id="long-break-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 20, 30].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sessions until Long Break</Label>
            <Select value="4" disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 sessions (fixed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Behavior Settings */}
        <div className="space-y-4">
          <h3 className="font-medium">Behavior</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-start breaks</p>
                <p className="text-sm text-muted-foreground">Automatically start break after focus session</p>
              </div>
              <Switch
                checked={settings.autoStartBreaks}
                onCheckedChange={(c) => updateSetting('autoStartBreaks', c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-start focus sessions</p>
                <p className="text-sm text-muted-foreground">Automatically start next focus after break</p>
              </div>
              <Switch
                checked={settings.autoStartPomodoros}
                onCheckedChange={(c) => updateSetting('autoStartPomodoros', c)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Sound & Notifications */}
        <div className="space-y-4">
          <h3 className="font-medium">Sound & Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sound notifications</p>
                <p className="text-sm text-muted-foreground">Play sound when timer completes</p>
              </div>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(c) => updateSetting('soundEnabled', c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Browser notifications</p>
                <p className="text-sm text-muted-foreground">Show system notification when timer completes</p>
              </div>
              <Switch
                checked={settings.notificationsEnabled}
                onCheckedChange={(c) => updateSetting('notificationsEnabled', c)}
              />
            </div>

            {settings.soundEnabled && (
              <div className="space-y-2">
                <Label>Notification Volume</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateSetting('soundEnabled', false)}
                  >
                    {settings.volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                  <Slider
                    value={[settings.volume * 100]}
                    onValueChange={([v]: number[]) => updateSetting('volume', v / 100)}
                    max={100}
                    step={10}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-10 text-right">
                    {Math.round(settings.volume * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Preview */}
        <div className="space-y-4">
          <h3 className="font-medium">Session Preview</h3>
          <div className="grid grid-cols-3 gap-4">
            <SessionPreviewCard
              icon={<Zap className="h-6 w-6 text-primary" />}
              label="Focus"
              duration={settings.pomodoroDuration}
              color="primary"
            />
            <SessionPreviewCard
              icon={<Coffee className="h-6 w-6 text-green-500" />}
              label="Short Break"
              duration={settings.shortBreakDuration}
              color="green"
            />
            <SessionPreviewCard
              icon={<Moon className="h-6 w-6 text-blue-500" />}
              label="Long Break"
              duration={settings.longBreakDuration}
              color="blue"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            After 4 focus sessions, you&apos;ll get a long break instead of a short break.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface SessionPreviewCardProps {
  icon: React.ReactNode
  label: string
  duration: number
  color: 'primary' | 'green' | 'blue'
}

function SessionPreviewCard({ icon, label, duration, color }: SessionPreviewCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 border-primary/20 text-primary',
    green: 'bg-green-500/10 border-green-500/20 text-green-500',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
  }

  return (
    <div className={cn('p-4 rounded-lg border text-center', colorClasses[color])}>
      <div className="mb-2">{icon}</div>
      <p className="font-medium">{label}</p>
      <p className="text-2xl font-bold">{duration} min</p>
    </div>
  )
}