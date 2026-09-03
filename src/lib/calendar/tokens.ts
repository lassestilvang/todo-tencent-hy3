import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/calendar'

// Shape of the google_calendar_tokens cookie, set by the OAuth callback.
interface StoredTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  scope?: string
}

export function readStoredTokens(request: NextRequest): StoredTokens | null {
  const cookie = request.cookies.get('google_calendar_tokens')?.value
  if (!cookie) return null
  try {
    return JSON.parse(cookie) as StoredTokens
  } catch {
    return null
  }
}

export interface ValidAccessToken {
  accessToken: string
  // Set when the stored tokens were refreshed and the cookie must be re-set
  cookieValue?: string
}

// Returns a usable access token, transparently refreshing the stored tokens
// (and reporting the new cookie value) when they have expired. Returns null
// when there is nothing to authenticate with or the refresh fails.
export async function getValidAccessToken(
  request: NextRequest
): Promise<ValidAccessToken | null> {
  const tokens = readStoredTokens(request)
  if (!tokens) return null

  if (Date.now() < tokens.expires_at) {
    return { accessToken: tokens.access_token }
  }

  // Expired: refresh when we have a refresh token and client credentials
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
  if (!tokens.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null
  }

  try {
    const fresh = await refreshAccessToken(
      tokens.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    )
    const next: StoredTokens = {
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + fresh.expires_in * 1000,
      scope: fresh.scope,
    }
    return { accessToken: fresh.access_token, cookieValue: JSON.stringify(next) }
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

// Re-sets the google_calendar_tokens cookie after a transparent refresh.
export function applyTokensCookie(
  response: NextResponse,
  cookieValue?: string
): void {
  if (!cookieValue) return
  response.cookies.set('google_calendar_tokens', cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}
