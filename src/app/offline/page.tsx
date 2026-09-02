'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, Home, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // Initialize state after mount to avoid synchronous setState in effect
    const initializeOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }
    initializeOnlineStatus()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (isOnline) {
      window.location.href = '/today'
    }
  }, [isOnline])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
          <WifiOff className="h-12 w-12 text-white" />
        </div>

        <h1 className="text-3xl font-bold mb-2">You&apos;re Offline</h1>
        <p className="text-muted-foreground mb-8">
          No internet connection detected. Some features may be limited.
        </p>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Offline Tasks</p>
                  <p className="text-sm text-muted-foreground">View and edit cached tasks</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <WifiOff className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Sync Pending</p>
                  <p className="text-sm text-muted-foreground">Changes will sync when online</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <RefreshCw className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Auto Reconnect</p>
                  <p className="text-sm text-muted-foreground">We&apos;ll redirect when back online</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
            disabled={!isOnline}
          >
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            {isOnline ? 'Reconnecting...' : 'Try Again'}
          </Button>
          <Link href="/today">
            <Button variant="outline" className="w-full">
              <Home className="mr-2 h-4 w-4" />
              View Cached Tasks
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          TaskFlow works offline using Service Worker caching. Your data is stored locally.
        </p>
      </div>
    </div>
  )
}