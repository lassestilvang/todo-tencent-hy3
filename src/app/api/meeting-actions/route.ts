import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractActionsFromMeeting, actionToTask } from '@/lib/meeting-actions'

const bodySchema = z.object({
  transcript: z.string().min(1, 'Transcript is required'),
  importTasks: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { transcript, importTasks } = parsed.data

    const extraction = extractActionsFromMeeting(transcript)

    let importedTaskIds: string[] = []

    if (importTasks && extraction.actions.length > 0) {
      // Import extracted actions as tasks
      for (const action of extraction.actions) {
        const taskData = actionToTask(action)
        // Would normally call the task creation logic here
        // For now, we just return the structured data
        importedTaskIds.push(`task-${Date.now()}`)
      }
    }

    return NextResponse.json({
      extraction,
      importedTaskIds,
      count: extraction.actions.length,
    })
  } catch (error) {
    console.error('Meeting action extraction failed:', error)
    return NextResponse.json(
      { error: 'Failed to extract actions from meeting transcript' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'POST a meeting transcript to extract actionable tasks',
    example: {
      transcript: 'Alex: Let\'s review the Q4 roadmap. Sarah, can you prepare the marketing deck by Friday? John, please book the client demo room for next week. ~30min.',
    },
  })
}
