'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PushNotificationsSettings } from '@/components/push-notifications-settings'
import { FocusModeSettings } from '@/components/focus-mode-settings'
import { ThemeToggle } from '@/components/theme-toggle'
import { Bell, Palette, Database, Key, User, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState('general')
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [compactMode, setCompactMode] = useState(false)
  const [autoSave, setAutoSave] = useState(true)
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAnimationsEnabled(localStorage.getItem('animations-enabled') !== 'false')
      setCompactMode(localStorage.getItem('compact-mode') === 'true')
      setAutoSave(localStorage.getItem('auto-save') !== 'false')
      setLanguage(localStorage.getItem('language') || 'en')
    }
  }, [])

  const handleAnimationsChange = (enabled: boolean) => {
    setAnimationsEnabled(enabled)
    localStorage.setItem('animations-enabled', String(enabled))
    document.documentElement.classList.toggle('reduce-motion', !enabled)
  }

  const handleCompactModeChange = (enabled: boolean) => {
    setCompactMode(enabled)
    localStorage.setItem('compact-mode', String(enabled))
  }

  const handleAutoSaveChange = (enabled: boolean) => {
    setAutoSave(enabled)
    localStorage.setItem('auto-save', String(enabled))
  }

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
  }

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      localStorage.clear()
      toast.success('All local data cleared')
    }
  }

  const handleExportData = () => {
    const data = {
      settings: {
        animationsEnabled,
        compactMode,
        autoSave,
        language,
      },
      focusMode: JSON.parse(localStorage.getItem('focus-mode-settings') || '{}'),
      focusStats: JSON.parse(localStorage.getItem('focus-mode-stats') || '{}'),
      dismissedSuggestions: JSON.parse(localStorage.getItem('dismissed_suggestions') || '[]'),
      pushSubscription: localStorage.getItem('push-subscription'),
      notificationTypes: {
        'task-reminders': localStorage.getItem('notification-task-reminders'),
        'focus-sessions': localStorage.getItem('notification-focus-sessions'),
        'daily-digest': localStorage.getItem('notification-daily-digest'),
        'weekly-report': localStorage.getItem('notification-weekly-report'),
      },
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `taskflow-settings-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Settings exported')
  }

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)

        if (data.settings) {
          localStorage.setItem('animations-enabled', String(data.settings.animationsEnabled))
          localStorage.setItem('compact-mode', String(data.settings.compactMode))
          localStorage.setItem('auto-save', String(data.settings.autoSave))
          localStorage.setItem('language', data.settings.language)
          handleAnimationsChange(data.settings.animationsEnabled)
          handleCompactModeChange(data.settings.compactMode)
          handleAutoSaveChange(data.settings.autoSave)
          handleLanguageChange(data.settings.language)
        }

        if (data.focusMode) {
          localStorage.setItem('focus-mode-settings', JSON.stringify(data.focusMode))
        }
        if (data.focusStats) {
          localStorage.setItem('focus-mode-stats', JSON.stringify(data.focusStats))
        }
        if (data.dismissedSuggestions) {
          localStorage.setItem('dismissed_suggestions', JSON.stringify(data.dismissedSuggestions))
        }
        if (data.pushSubscription) {
          localStorage.setItem('push-subscription', data.pushSubscription)
        }
        if (data.notificationTypes) {
          Object.entries(data.notificationTypes).forEach(([key, value]) => {
            if (value) localStorage.setItem(`notification-${key}`, value as string)
          })
        }

        toast.success('Settings imported successfully. Please refresh the page.')
      } catch {
        toast.error('Invalid settings file')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your TaskFlow preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" /> General
            </span>
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <span className="flex items-center gap-1">
              <Palette className="h-4 w-4" /> Appearance
            </span>
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <span className="flex items-center gap-1">
              <Bell className="h-4 w-4" /> Notifications
            </span>
          </TabsTrigger>
          <TabsTrigger value="focus">
            <span className="flex items-center gap-1">
              <Shield className="h-4 w-4" /> Focus Mode
            </span>
          </TabsTrigger>
          <TabsTrigger value="data">
            <span className="flex items-center gap-1">
              <Database className="h-4 w-4" /> Data
            </span>
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                General Preferences
              </CardTitle>
              <CardDescription>
                Basic application behavior settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Animations</Label>
                  <p className="text-sm text-muted-foreground">Enable UI animations and transitions</p>
                </div>
                <Switch
                  checked={animationsEnabled}
                  onCheckedChange={handleAnimationsChange}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">Reduce spacing for more content</p>
                </div>
                <Switch
                  checked={compactMode}
                  onCheckedChange={handleCompactModeChange}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Save</Label>
                  <p className="text-sm text-muted-foreground">Automatically save changes</p>
                </div>
                <Switch
                  checked={autoSave}
                  onCheckedChange={handleAutoSaveChange}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of TaskFlow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark theme</p>
                </div>
                <ThemeToggle />
              </div>

              <Separator />

              <div>
                <Label>Theme Color</Label>
                <p className="text-sm text-muted-foreground mb-3">Coming soon: Custom accent colors</p>
                <div className="flex gap-2">
                  {['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4'].map((color) => (
                    <button
                      key={color}
                      className={cn(
                        'h-8 w-8 rounded-lg border-2 transition-all',
                        color === '#6366f1' && 'border-primary'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => toast.info('Custom themes coming soon!')}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <PushNotificationsSettings />
        </TabsContent>

        {/* Focus Mode Tab */}
        <TabsContent value="focus" className="space-y-6">
          <FocusModeSettings />
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                Export, import, and manage your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Export Settings</p>
                  <p className="text-sm text-muted-foreground">
                    Download all your settings and preferences as a JSON file
                  </p>
                </div>
                <Button onClick={handleExportData}>
                  Export Data
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Import Settings</p>
                  <p className="text-sm text-muted-foreground">
                    Restore settings from a previously exported JSON file
                  </p>
                </div>
                <Button variant="outline" className="relative">
                  Import Data
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Clear All Data</p>
                  <p className="text-sm text-destructive/80">
                    Permanently delete all local data including tasks, settings, and history
                  </p>
                </div>
                <Button variant="destructive" onClick={handleClearData}>
                  Clear All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

import { useEffect } from 'react'