import { Suspense } from 'react'
import { FocusBuddy } from '@/components/focus-buddy'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export const metadata = {
  title: 'FocusBuddy | TaskFlow',
  description: 'Your AI-powered focus companion for pomodoro-style work sessions',
}

export default function FocusPage() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">FocusBuddy</h1>
        <p className="text-muted-foreground">
          Your AI-powered focus companion. Choose a personality and start a timed work session
          with real-time encouragement, tips, and post-session analysis.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Personalities</CardTitle>
          <CardDescription>Choose how your FocusBuddy motivates you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div>
              <strong>Coach</strong> — Supportive and encouraging, with practical tips
            </div>
            <div>
              <strong>Drill Sergeant</strong> — Strict and disciplined, pushing you to your limits
            </div>
            <div>
              <strong>Zen</strong> — Calm and mindful, helping you stay present and centered
            </div>
            <div>
              <strong>Cheerleader</strong> — High-energy and enthusiastic, celebrating every win
            </div>
          </div>
        </CardContent>
      </Card>

      <Suspense fallback={<div className="text-center py-8">Loading FocusBuddy...</div>}>
        <FocusBuddy />
      </Suspense>
    </div>
  )
}
