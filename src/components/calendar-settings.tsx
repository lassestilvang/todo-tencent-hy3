'use client'

import { useState, useEffect } from 'react'
import { Calendar, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CalendarInfo {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
  foregroundColor?: string
  selected?: boolean
}

export function CalendarSettings() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<string>('')
  const [autoSync, setAutoSync] = useState(false)
  const [syncDirection, setSyncDirection] = useState<'one-way' | 'two-way'>('one-way')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    checkConnection()
    loadSettings()
  }, [])

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/calendar/status')
      if (res.ok) {
        const data = await res.json()
        setIsConnected(data.connected)
        if (data.calendars) {
          setCalendars(data.calendars)
          setSelectedCalendar(data.selectedCalendar || data.calendars[0]?.id || '')
        }
        setLastSync(data.lastSync)
      }
    } catch (error) {
      console.error('Failed to check calendar connection:', error)
    }
  }

  const loadSettings = () => {
    if (typeof window !== 'undefined') {
      setAutoSync(localStorage.getItem('calendar-auto-sync') === 'true')
      setSyncDirection((localStorage.getItem('calendar-sync-direction') as 'one-way' | 'two-way') || 'one-way')
      setSelectedCalendar(localStorage.getItem('calendar-selected') || '')
    }
  }

  const handleConnect = () => {
    window.location.href = '/api/auth/google'
  }

  const handleDisconnect = async () => {
    if (confirm('Disconnect Google Calendar? This will remove the connection but keep your tasks.')) {
      try {
        await fetch('/api/calendar/disconnect', { method: 'POST' })
        setIsConnected(false)
        setCalendars([])
        setSelectedCalendar('')
        localStorage.removeItem('calendar-selected')
        toast.success('Calendar disconnected')
      } catch (error) {
        toast.error('Failed to disconnect')
      }
    }
  }

  const handleSync = async () => {
    setSyncStatus('syncing')
    setSyncError(null)

    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        setSyncStatus('success')
        setLastSync(data.lastSync)
        toast.success(`Synced ${data.synced} tasks to ${data.calendar}`)
      } else {
        setSyncStatus('error')
        setSyncError(data.errors?.join(', ') || data.error || 'Sync failed')
        toast.error(`Sync failed: ${data.error}`)
      }
    } catch (error) {
      setSyncStatus('error')
      setSyncError('Network error')
      toast.error('Sync failed: Network error')
    }
  }

  const handleCalendarChange = (calendarId: string) => {
    setSelectedCalendar(calendarId)
    localStorage.setItem('calendar-selected', calendarId)
  }

  const handleAutoSyncChange = (enabled: boolean) => {
    setAutoSync(enabled)
    localStorage.setItem('calendar-auto-sync', String(enabled))
  }

  const handleDirectionChange = (direction: 'one-way' | 'two-way') => {
    setSyncDirection(direction)
    localStorage.setItem('calendar-sync-direction', direction)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Google Calendar Integration
        </CardTitle>
        <CardDescription>
          Sync tasks with Google Calendar for two-way scheduling
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-3 w-3 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-muted-foreground/50'
              )} />
              <div>
                <p className="font-medium">{isConnected ? 'Connected' : 'Not Connected'}</p>
                <p className="text-sm text-muted-foreground">
                  {isConnected
                    ? `Syncing with ${calendars.find(c => c.id === selectedCalendar)?.summary || 'Google Calendar'}`
                    : 'Connect to sync tasks with Google Calendar'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleSync} disabled={isLoading || syncStatus === 'syncing'}>
                    {syncStatus === 'syncing' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Sync Now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect Google Calendar
                </Button>
              )}
            </div>
          </div>

          {isConnected && lastSync && (
            <div className="text-sm text-muted-foreground">
              Last synced: {new Date(lastSync).toLocaleString()}
            </div>
          )}

          {syncStatus === 'success' && (
            <div className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Last sync successful
            </div>
          )}

          {syncStatus === 'error' && syncError && (
            <div className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Sync error: {syncError}
            </div>
          )}
        </div>

        {isConnected && (
          <>
            <Separator />

            {/* Calendar Selection */}
            <div className="space-y-4">
              <Label>Sync Calendar</Label>
              <p className="text-sm text-muted-foreground">
                Choose which Google Calendar to sync with
              </p>
              <div className="space-y-2">
                {calendars.map((cal) => (
                  <label
                    key={cal.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                      selectedCalendar === cal.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="sync-calendar"
                        value={cal.id}
                        checked={selectedCalendar === cal.id}
                        onChange={() => handleCalendarChange(cal.id)}
                        className="text-primary"
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full border-2"
                          style={{
                            borderColor: cal.backgroundColor || '#6366f1',
                            backgroundColor: cal.backgroundColor || '#6366f1',
                          }}
                        />
                        <div>
                          <p className="font-medium">{cal.summary}</p>
                          {cal.primary && <span className="text-xs text-muted-foreground">Primary</span>}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Sync Options */}
            <div className="space-y-4">
              <h3 className="font-medium">Sync Options</h3>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync when tasks change
                  </p>
                </div>
                <Switch
                  checked={autoSync}
                  onCheckedChange={handleAutoSyncChange}
                />
              </div>

              <Separator className="my-2" />

              <div>
                <Label>Sync Direction</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Choose how tasks and calendar events sync
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors text-center',
                      syncDirection === 'one-way'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="sync-direction"
                      value="one-way"
                      checked={syncDirection === 'one-way'}
                      onChange={() => handleDirectionChange('one-way')}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-medium">TaskFlow → Calendar</span>
                      <span className="text-xs text-muted-foreground">
                        Push tasks to calendar only
                      </span>
                    </div>
                  </label>
                  <label
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors text-center',
                      syncDirection === 'two-way'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="sync-direction"
                      value="two-way"
                      checked={syncDirection === 'two-way'}
                      onChange={() => handleDirectionChange('two-way')}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-medium">Two-way Sync</span>
                      <span className="text-xs text-muted-foreground">
                        Sync both directions (coming soon)
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <Separator />

            {/* What Gets Synced */}
            <div className="space-y-4">
              <h3 className="font-medium">What Gets Synced</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Tasks with due dates</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Task titles and descriptions</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Estimated duration as event length</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Priority as event color (high=red, medium=yellow, low=green)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Subtasks (not synced individually)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Recurring tasks (synced as series)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Completed tasks (removed from calendar)</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}