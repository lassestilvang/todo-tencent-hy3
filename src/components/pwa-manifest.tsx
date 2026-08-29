'use client'

import { useEffect, useState } from 'react'
import { Download, X, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function PWAManifest() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setIsStandalone(standalone)

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(iOS)

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)

      // Show prompt after a delay if not dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed && !standalone) {
        setTimeout(() => setShowInstallPrompt(true), 30000) // 30 seconds
      }
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstallable(false)
      setShowInstallPrompt(false)
      localStorage.setItem('pwa-installed', 'true')
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
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
      setIsInstallable(false)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  // Don't show if already installed or dismissed
  if (isStandalone || localStorage.getItem('pwa-installed') || localStorage.getItem('pwa-install-dismissed')) {
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