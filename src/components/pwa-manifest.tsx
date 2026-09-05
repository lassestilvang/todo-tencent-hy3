'use client'

import { useEffect, useState } from 'react'
import { Download, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOfflineSync } from '@/lib/use-offline-sync'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function checkStandalone() {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
}

function checkIOS() {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

export function PWAManifest() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS] = useState(() => checkIOS())
  const [isStandalone] = useState(() => checkStandalone())

  // Set up offline caching and sync
  useOfflineSync()

  useEffect(() => {
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Show prompt after a delay if not dismissed before
      if (typeof window !== 'undefined') {
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (!dismissed && !isStandalone) {
          setTimeout(() => setShowInstallPrompt(true), 30000) // 30 seconds
        }
      }
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa-installed', 'true')
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isStandalone])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('pwa-install-dismissed', 'true')
    }
  }

  // Don't show if already installed or dismissed
  const isInstalled = typeof window !== 'undefined' && localStorage.getItem('pwa-installed')
  const isDismissed = typeof window !== 'undefined' && localStorage.getItem('pwa-install-dismissed')
  if (isStandalone || isInstalled || isDismissed) {
    return null
  }

  // Show install prompt dialog
  return (
    <Dialog open={showInstallPrompt} onOpenChange={setShowInstallPrompt}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Install TaskFlow
          </DialogTitle>
          <DialogDescription>
            Add TaskFlow to your home screen for quick access and offline support
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-20 flex flex-col items-center gap-2" disabled={isIOS}>
              <Monitor className="h-6 w-6" />
              <span className="text-xs">Desktop</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center gap-2" disabled={!isIOS}>
              <Smartphone className="h-6 w-6" />
              <span className="text-xs">Mobile</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {isIOS
              ? 'Tap Share → "Add to Home Screen" in Safari'
              : 'Click Install to add to your device'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleDismiss} className="flex-1">
            Not Now
          </Button>
          <Button onClick={handleInstall} className="flex-1" disabled={isIOS}>
            {isIOS ? 'Show Me How' : 'Install'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}