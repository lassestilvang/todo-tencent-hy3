import { MeetingActionExtractor } from '@/components/meeting-action-extractor'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export const metadata = {
  title: 'Meeting Action Extractor | TaskFlow',
  description: 'Extract actionable tasks from meeting transcripts with AI-powered parsing',
}

export default function MeetingPage() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meeting Action Extractor</h1>
        <p className="text-muted-foreground">
          Paste meeting transcripts to automatically extract actionable tasks with
          assignees, deadlines, time estimates, and priority levels
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            The extractor identifies action items by looking for action verbs
            (review, prepare, schedule, etc.), assignee mentions (@name),
            deadlines (by Friday, EOD), and time estimates (~30min).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground list-disc list-inside">
            <li>Action verbs like "review", "prepare", "schedule" trigger extraction</li>
            <li>@mentions and "Please [Name]" identify assignees</li>
            <li>Deadlines like "by Friday" or "EOD" set due dates</li>
            <li>Time estimates like "~30 min" or "1h" set duration</li>
            <li>Priority keywords like "urgent" or "asap" mark important tasks</li>
          </ul>
        </CardContent>
      </Card>

      <MeetingActionExtractor />
    </div>
  )
}
