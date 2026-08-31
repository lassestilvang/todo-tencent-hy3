import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear all calendar-related cookies
  response.cookies.delete('google_calendar_tokens')
  response.cookies.delete('calendar-selected')
  response.cookies.delete('calendar-last-sync')

  return response
}