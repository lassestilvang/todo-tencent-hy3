/**
 * Async Standup System
 *
 * Enables team standups without real-time meetings. Team members
 * answer three questions asynchronously:
 * 1. What did I accomplish yesterday?
 * 2. What will I work on today?
 * 3. What's blocking me?
 *
 * Answers are stored and aggregated into a digest that can be
 * shared via Slack, email, or the analytics dashboard.
 */

export type StandupQuestion = 'yesterday' | 'today' | 'blockers'

export interface StandupResponse {
  id: string
  userId: string
  userName: string
  date: string // YYYY-MM-DD
  question: StandupQuestion
  answer: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface StandupState {
  date: string
  responses: Record<string, Record<StandupQuestion, StandupResponse | null>>
  isComplete: boolean
}

export interface StandupDigest {
  date: string
  summary: string
  teamSize: number
  completionRate: number
  blockers: StandupResponse[]
  highlights: string[]
  actionItems: string[]
}

/** Generate the list of standup questions. */
export function getStandupQuestions(): { id: StandupQuestion; label: string; placeholder: string }[] {
  return [
    {
      id: 'yesterday',
      label: 'What did you accomplish yesterday?',
      placeholder: 'e.g. Finished the API integration, reviewed 3 PRs, had sync with design team',
    },
    {
      id: 'today',
      label: 'What will you work on today?',
      placeholder: 'e.g. Implement the new dashboard, fix the auth bug, write tests',
    },
    {
      id: 'blockers',
      label: 'What\'s blocking you?',
      placeholder: 'e.g. Waiting on the API keys, stuck on the caching bug, need design review',
    },
  ]
}

/** Check if a user has completed all standup questions for a given date. */
export function isStandupComplete(
  responses: Record<StandupQuestion, StandupResponse | null>
): boolean {
  return (
    responses.yesterday !== null &&
    responses.today !== null &&
    responses.blockers !== null
  )
}

/** Generate a digest of all standup responses for a date. */
export function generateStandupDigest(
  responses: StandupResponse[],
  teamMembers: { id: string; name: string }[],
  date: string
): StandupDigest {
  // Group responses by user
  const byUser = new Map<string, Record<StandupQuestion, StandupResponse | null>>()
  for (const member of teamMembers) {
    byUser.set(member.id, { yesterday: null, today: null, blockers: null })
  }

  for (const response of responses) {
    const userResponses = byUser.get(response.userId)
    if (userResponses) {
      userResponses[response.question] = response
    }
  }

  const completed = teamMembers.filter((m) =>
    isStandupComplete(byUser.get(m.id) || { yesterday: null, today: null, blockers: null })
  )

  // Extract blockers
  const blockerResponses = responses.filter(
    (r) => r.question === 'blockers' && r.answer.trim() !== ''
  )

  // Extract highlights (positive keywords from yesterday/today answers)
  const highlights: string[] = []
  for (const response of responses.filter((r) => r.question === 'yesterday' || r.question === 'today')) {
    const positiveKeywords = ['completed', 'finished', 'shipped', 'deployed', 'launched', 'solved', 'fixed', 'built', 'created']
    const lowerAnswer = response.answer.toLowerCase()
    for (const keyword of positiveKeywords) {
      if (lowerAnswer.includes(keyword)) {
        const snippet = response.answer.slice(0, 100) + (response.answer.length > 100 ? '...' : '')
        highlights.push(`${response.userName}: ${snippet}`)
        break
      }
    }
  }

  // Generate action items from blockers
  const actionItems = blockerResponses.map((r) => `${r.userName} needs help: ${r.answer.slice(0, 120)}`)

  // Generate summary
  const summary = `${completed.length}/${teamMembers.length} team members completed their standup. ` +
    `${blockerResponses.length} blockers identified. ` +
    `${highlights.length} highlights noted.`

  return {
    date,
    summary,
    teamSize: teamMembers.length,
    completionRate: completed.length / (teamMembers.length || 1),
    blockers: blockerResponses,
    highlights: highlights.slice(0, 10),
    actionItems,
  }
}
