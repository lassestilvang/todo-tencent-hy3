declare module 'web-push' {
  interface VapidKeys {
    publicKey: string
    privateKey: string
  }

  interface SendResult {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  interface PushSubscription {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }

  interface WebPushOptions {
    vapidDetails?: {
      subject: string
      publicKey: string
      privateKey: string
    }
    headers?: Record<string, string>
    proxy?: string
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  function generateVAPIDKeys(): VapidKeys
  function sendNotification(
    subscription: PushSubscription,
    payload: string | Buffer,
    options?: WebPushOptions
  ): Promise<SendResult>

  export { setVapidDetails, generateVAPIDKeys, sendNotification }
}