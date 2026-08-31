import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/calendar'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth errors
  if (error) {
    return NextResponse.redirect(`${APP_URL}/settings?error=${encodeURIComponent(error)}`)
  }

  // Verify state parameter
  const storedState = request.cookies.get('oauth_state')?.value
  const codeVerifier = request.cookies.get('oauth_code_verifier')?.value

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${APP_URL}/settings?error=invalid_state`)
  }

  if (!code || !codeVerifier) {
    return NextResponse.redirect(`${APP_URL}/settings?error=missing_params`)
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${APP_URL}/settings?error=not_configured`)
  }

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )

    // Store tokens securely (in production, use encrypted database storage)
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    }

    const response = NextResponse.redirect(`${APP_URL}/settings?calendar=connected`)

    // Store in httpOnly cookie (for demo - use secure DB in production)
    response.cookies.set('google_calendar_tokens', JSON.stringify(tokenData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    // Clear OAuth temp cookies
    response.cookies.delete('oauth_state')
    response.cookies.delete('oauth_code_verifier')

    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${APP_URL}/settings?error=token_exchange_failed`)
  }
}