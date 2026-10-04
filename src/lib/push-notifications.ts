export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
  actions?: { action: string; title: string; icon?: string }[]
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const _VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
void _VAPID_PRIVATE_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPushNotifications(): Promise<PushSubscriptionData | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported')
    return null
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('VAPID public key not configured')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    })

    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
      },
    }

    // Save to localStorage for reference
    localStorage.setItem('push-subscription', JSON.stringify(subscriptionData))

    // Send to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData),
    })

    return subscriptionData
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error)
    return null
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
      localStorage.removeItem('push-subscription')

      // Notify server
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })

      return true
    }
    return false
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error)
    return false
  }
}

export function getPushSubscription(): PushSubscriptionData | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('push-subscription')
  return stored ? JSON.parse(stored) : null
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  return Notification.requestPermission()
}

export async function sendLocalNotification(payload: NotificationPayload): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return

  const notification = new Notification(payload.title, {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-72x72.png',
    data: payload.data,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction,
    silent: payload.silent,
  })

  notification.onclick = () => {
    window.focus()
    if (payload.data?.url) {
      window.location.href = payload.data.url as string
    }
    notification.close()
  }
}

export async function scheduleNotification(payload: NotificationPayload, delayMs: number): Promise<NodeJS.Timeout> {
  return setTimeout(() => {
    sendLocalNotification(payload)
  }, delayMs)
}

export function cancelScheduledNotification(timeoutId: NodeJS.Timeout): void {
  clearTimeout(timeoutId)
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  // This would typically be done server-side with web-push library
  // For reference, here's how to generate them:
  // const webpush = require('web-push')
  // const vapidKeys = webpush.generateVAPIDKeys()
  // console.log(vapidKeys)
  return {
    publicKey: '',
    privateKey: '',
  }
}

// Service Worker message types
export type SWMessageType = 'SKIP_WAITING' | 'GET_VERSION' | 'CLEAR_CACHE'

export function sendSWMessage(type: SWMessageType, payload?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      reject(new Error('Service Worker not supported'))
      return
    }

    navigator.serviceWorker.ready.then((registration) => {
      if (!registration.active) {
        reject(new Error('No active service worker'))
        return
      }

      const channel = new MessageChannel()
      channel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error))
        } else {
          resolve(event.data)
        }
      }

      registration.active.postMessage({ type, payload }, [channel.port2])
    })
  })
}