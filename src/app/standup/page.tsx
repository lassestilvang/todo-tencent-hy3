import { AsyncStandup } from '@/components/async-standup'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export const metadata = {
  title: 'Async Standup | TaskFlow',
  description: 'Team standups without meetings - answer questions asynchronously',
}

// Mock team members - in a real app this would come from the workspace
const TEAM_MEMBERS = [
  { id: 'user-1', name: 'You' },
  { id: 'user-2', name: 'Alex Chen' },
  { id: 'user-3', name: 'Sam Rivera' },
  { id: 'user-4', name: 'Jordan Kim' },
]

export default function StandupPage() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Async Standup</h1>
        <p className="text-muted-foreground">
          Answer your daily standup questions asynchronously — no meeting required.
          Your teammates' responses are collected and aggregated into a shared digest.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            Answer three questions: what you did yesterday, what you'll do today, and any blockers.
            Your responses are collected in real time and summarized into a digest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground list-disc list-inside">
            <li>Answer at your own pace, from any device</li>
            <li>Team blockers are highlighted automatically</li>
            <li>Digest includes highlights and action items</li>
            <li>Data stored locally and syncs when online</li>
          </ul>
        </CardContent>
      </Card>

      <AsyncStandup
        teamMembers={TEAM_MEMBERS}
        currentUserId="user-1"
      />
    </div>
  )
}
