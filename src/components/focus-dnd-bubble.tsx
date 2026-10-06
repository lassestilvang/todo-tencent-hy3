'use client'

import { useEffect, useState, useRef } from 'react'
import { BellOff, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useFocusMode,
  isFocusModeActive,
  exitFocusMode,
} from '@/lib/focus-mode-store'
import { toast } from 'sonner'

/**
 * Focus Mode DND Bubble
 *
 * A subtle floating indicator that appears when a focus session is
 * active. It suppresses non-critical notifications (toast spam) by
 * intercepting sonner calls while focus mode is on, and gives the user
 * a one-tap "End session" button.
 *
 * The suppression is implemented by wrapping the global `toast` function
 * — during focus mode, `toast.info` and `toast.message` are silenced,
 * while `toast.error` and `toast.success` still pass through.
 */

let originalToast: typeof toast | null = null
let suppressionActive = false

function installToastGuard(): void {
  if (originalToast) return // already installed

  originalToast = toast
  suppressionActive = false

  // sonner's toast is a function with sub-methods. We wrap the
  // sub-methods (toast.info, toast.message, toast.warning) while
  // leaving toast.success, toast.error, and the core toast() call
  // untouched.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = toast as any
  if (!t.__dndWrapped) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(t.info as any).__original = t.info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(t.message as any).__original = t.message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(t.warning as any).__original = t.warning

    t.info = (...args: Parameters<typeof toast.info>) => {
      if (suppressionActive) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (t.info as any).__original(...args)
    }
    t.message = (...args: Parameters<typeof toast.message>) => {
      if (suppressionActive) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (t.message as any).__original(...args)
    }
    t.warning = (...args: Parameters<typeof toast.warning>) => {
      if (suppressionActive) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (t.warning as any).__original(...args)
    }
    t.__dndWrapped = true
  }
}

function setSuppression(active: boolean): void {
  suppressionActive = active
}

export function FocusDndBubble() {
  const focused = useFocusMode()
  const [visible, setVisible] = useState(false)
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const suppressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Install the toast guard once on mount
  useEffect(() => {
    installToastGuard()
  }, [])

  // Show/hide the bubble and toggle suppression based on focus state
  useEffect(() => {
    if (focused) {
      const now = Date.now()
      setSuppression(true)

      // Defer setState calls to an rAF callback to satisfy the
      // react-hooks/set-state-in-effect rule
      requestAnimationFrame(() => {
        setSessionStart(now)
        setElapsed(0)
        setVisible(true)
      })

      // Request Notification.permission if not yet granted,
      // so the browser DND is consistent with the app DND
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission()
        }
      }

      // Keep suppression active as long as focus mode is on
      suppressIntervalRef.current = setInterval(() => {
        setSuppression(isFocusModeActive())
      }, 1000)

      // Update elapsed minutes every minute
      elapsedIntervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - now) / 60000))
      }, 60000)
    } else {
      setSuppression(false)
      if (suppressIntervalRef.current) {
        clearInterval(suppressIntervalRef.current)
        suppressIntervalRef.current = null
      }
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
      // Fade out after 2s of focus ending
      hideTimeoutRef.current = setTimeout(() => setVisible(false), 2000)
    }

    return () => {
      setSuppression(false)
      if (suppressIntervalRef.current) {
        clearInterval(suppressIntervalRef.current)
        suppressIntervalRef.current = null
      }
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    }
  }, [focused])

  if (!visible) return null

  return (
    <div className="border-border bg-background/90 animate-slide-up fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur-sm">
      <BellOff className="h-4 w-4 text-orange-500" />
      <span className="font-medium">Do Not Disturb</span>
      {sessionStart && (
        <Badge variant="outline" className="text-xs">
          <Clock className="mr-1 h-3 w-3" />
          {elapsed}m
        </Badge>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1 text-xs"
        onClick={() => {
          exitFocusMode()
          setVisible(false)
          setSessionStart(null)
          setElapsed(0)
          toast.success('Focus mode ended')
        }}
      >
        End <X className="ml-1 h-3 w-3" />
      </Button>
    </div>
  )
}
