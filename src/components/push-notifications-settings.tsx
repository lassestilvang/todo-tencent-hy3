'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getPushSubscription,
  isPushSupported,
  requestNotificationPermission,
  sendLocalNotification,
} from '@/lib/push-notifications'

export function PushNotificationsSettings() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isLoading, setIsLoading] = useState(false)
  const [subscription, setSubscription] = useState<{
    endpoint: string
    keys: { p256dh: string; auth: string }
  } | null>(null)

  useEffect(() => {
    const init = async () => {
      const supported = await isPushSupported()
      setIsSupported(supported)

      if (supported && typeof window !== 'undefined') {
        const perm = Notification.permission
        setPermission(perm)

        const sub = getPushSubscription()
        if (sub) {
          setSubscription(sub)
          setIsSubscribed(true)
        }
      }
    }
    init()
  }, [])

  const handlePermissionRequest = async () => {
    setIsLoading(true)
    try {
      const perm = await requestNotificationPermission()
      setPermission(perm)

      if (perm === 'granted') {
        toast.success('Notifications enabled')
      } else {
        toast.error('Notifications permission denied')
      }
    } catch {
      toast.error('Failed to request permission')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (permission !== 'granted') {
      const newPermission = await requestNotificationPermission()
      if (newPermission !== 'granted') return
    }

    setIsLoading(true)
    try {
      const sub = await subscribeToPushNotifications()
      if (sub) {
        setSubscription(sub)
        setIsSubscribed(true)
        toast.success('Push notifications enabled')
      } else {
        toast.error('Failed to enable push notifications')
      }
    } catch {
      toast.error('Failed to enable push notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    setIsLoading(true)
    try {
      const success = await unsubscribeFromPushNotifications()
      if (success) {
        setSubscription(null)
        setIsSubscribed(false)
        toast.success('Push notifications disabled')
      } else {
        toast.error('Failed to disable push notifications')
      }
    } catch {
      toast.error('Failed to disable push notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      toast.error('Notification permission not granted')
      return
    }

    try {
      await sendLocalNotification({
        title: 'Test Notification',
        body: 'Push notifications are working correctly!',
        icon: '/icons/icon-192x192.png',
        tag: 'test-notification',
      })
      toast.success('Test notification sent')
    } catch {
      toast.error('Failed to send test notification')
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Your browser doesn&apos;t support the Push API.</p>
            <p className="text-sm mt-2">Try using Chrome, Firefox, Edge, or Safari.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive notifications for task reminders, focus sessions, and more
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-3 w-3 rounded-full',
                permission === 'granted' && 'bg-green-500',
                permission === 'denied' && 'bg-red-500',
                permission === 'default' && 'bg-yellow-500'
              )} />
              <div>
                <p className="font-medium">Browser Permission</p>
                <p className="text-sm text-muted-foreground capitalize">{permission}</p>
              </div>
            </div>
            {permission !== 'granted' && (
              <Button
                size="sm"
                onClick={handlePermissionRequest}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable'}
              </Button>
            )}
          </div>

          {permission === 'denied' && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                Notifications are blocked. Please enable them in your browser settings.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Push Subscription */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-3 w-3 rounded-full',
                isSubscribed ? 'bg-green-500' : 'bg-muted-foreground/50'
              )} />
              <div>
                <p className="font-medium">Push Subscription</p>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed ? 'Subscribed to push notifications' : 'Not subscribed'}
                </p>
              </div>
            </div>
            {isSubscribed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnsubscribe}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubscribe}
                disabled={isLoading || permission !== 'granted'}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable'}
              </Button>
            )}
          </div>

          {isSubscribed && subscription && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm font-mono text-muted-foreground">
              <p className="truncate">{subscription.endpoint}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Test Notification */}
        <div className="space-y-4">
          <p className="font-medium">Test Notification</p>
          <Button
            variant="outline"
            onClick={handleTestNotification}
            disabled={permission !== 'granted' || isLoading}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Send Test Notification
          </Button>
          <p className="text-sm text-muted-foreground">
            Sends a local notification to verify everything works
          </p>
        </div>

        <Separator />

        {/* Notification Types */}
        <div className="space-y-4">
          <p className="font-medium">Notification Types</p>
          <div className="space-y-3">
            <NotificationTypeToggle
              id="task-reminders"
              label="Task Reminders"
              description="Get reminded about upcoming and overdue tasks"
              defaultEnabled
            />
            <NotificationTypeToggle
              id="focus-sessions"
              label="Focus Sessions"
              description="Notifications when Pomodoro sessions complete"
              defaultEnabled
            />
            <NotificationTypeToggle
              id="daily-digest"
              label="Daily Digest"
              description="Morning summary of today's tasks"
            />
            <NotificationTypeToggle
              id="weekly-report"
              label="Weekly Report"
              description="Weekly productivity summary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface NotificationTypeToggleProps {
  id: string
  label: string
  description: string
  defaultEnabled?: boolean
}

function loadNotificationSetting(id: string, defaultEnabled: boolean) {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(`notification-${id}`)
    if (saved !== null) {
      try {
        return JSON.parse(saved)
      } catch {}
    }
  }
  return defaultEnabled
}

function NotificationTypeToggle({ id, label, description, defaultEnabled = false }: NotificationTypeToggleProps) {
  const [enabled, setEnabled] = useState(() => loadNotificationSetting(id, defaultEnabled))

  const handleChange = (checked: boolean) => {
    setEnabled(checked)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`notification-${id}`, JSON.stringify(checked))
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Label htmlFor={id} className="font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={enabled}
        onCheckedChange={handleChange}
      />
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}