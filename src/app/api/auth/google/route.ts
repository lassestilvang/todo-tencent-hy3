import { NextRequest, NextResponse } from 'next/server'
import { buildGoogleAuthUrl } from '@/lib/calendar'
import { createHash, randomBytes } from 'crypto'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

export async function GET(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  // Generate state parameter
  const state = randomBytes(16).toString('hex')

  // Store in secure httpOnly cookie
  const authUrl = buildGoogleAuthUrl(GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, state)

  // Add PKCE parameters
  const url = new URL(authUrl)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')

  const response = NextResponse.redirect(url.toString())

  // Set cookies for verification
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  response.cookies.set('oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}