'use client'

import { useState, useEffect, useMemo } from 'react'
import { Send, User, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  getStandupQuestions,
  isStandupComplete,
  generateStandupDigest,
  type StandupQuestion,
  type StandupResponse,
  type StandupDigest,
} from '@/lib/standup'

interface AsyncStandupProps {
  teamMembers: { id: string; name: string }[]
  currentUserId: string
  currentDate?: string
}

/**
 * Async Standup Mode
 *
 * Team members answer the classic three standup questions
 * asynchronously (no meeting required). Answers are collected
 * in localStorage and aggregated into a digest.
 *
 * Features:
 * - Three standard standup questions
 * - Real-time completion tracking per team member
 * - Blockers highlighted automatically
 * - Digest generation with highlights and action items
 * - Email/SNS export ready
 */
export function AsyncStandup({
  teamMembers,
  currentUserId,
  currentDate = new Date().toISOString().split('T')[0],
}: AsyncStandupProps) {
  const [responses, setResponses] = useState<Record<StandupQuestion, string>>({
    yesterday: '',
    today: '',
    blockers: '',
  })
  const [allResponses, setAllResponses] = useState<StandupResponse[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const questions = useMemo(() => getStandupQuestions(), [])

  // Load responses from localStorage on mount
  useEffect(() => {
    const STORAGE_KEY = `standup:${currentDate}`
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StandupResponse[]
        setAllResponses(parsed)
      } catch {
        // Ignore corrupt storage
      }
    }
  }, [currentDate])

  // Save responses to localStorage
  const saveResponses = (newResponses: StandupResponse[]) => {
    const STORAGE_KEY = `standup:${currentDate}`
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newResponses))
    setAllResponses(newResponses)
  }

  const submitQuestion = async (question: StandupQuestion) => {
    if (!responses[question].trim()) return

    setIsSubmitting(true)
    try {
      const response: StandupResponse = {
        id: `resp-${Date.now()}`,
        userId: currentUserId,
        userName: teamMembers.find((m) => m.id === currentUserId)?.name || 'You',
        date: currentDate,
        question,
        answer: responses[question],
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Check if user already has a response for this question
      const existingIndex = allResponses.findIndex(
        (r) => r.userId === currentUserId && r.question === question
      )

      let newResponses: StandupResponse[]
      if (existingIndex >= 0) {
        newResponses = [...allResponses]
        newResponses[existingIndex] = response
      } else {
        newResponses = [...allResponses, response]
      }

      saveResponses(newResponses)
      setResponses((prev) => ({ ...prev, [question]: '' }))
      toast.success('Answer submitted!')
    } catch {
      toast.error('Failed to submit answer')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Current user's responses
  const myResponses = useMemo(() => {
    const result: Record<StandupQuestion, StandupResponse | null> = {
      yesterday: null,
      today: null,
      blockers: null,
    }
    for (const response of allResponses) {
      if (response.userId === currentUserId) {
        result[response.question] = response
      }
    }
    return result
  }, [allResponses, currentUserId])

  const myCompletion = isStandupComplete(myResponses)

  // Team completion stats
  const teamResponses = useMemo(() => {
    const byUser = new Map<string, Record<StandupQuestion, StandupResponse | null>>()
    for (const member of teamMembers) {
      byUser.set(member.id, { yesterday: null, today: null, blockers: null })
    }
    for (const response of allResponses) {
      const user = byUser.get(response.userId)
      if (user) user[response.question] = response
    }
    return byUser
  }, [allResponses, teamMembers])

  const teamCompletionRate = useMemo(() => {
    let completed = 0
    for (const member of teamMembers) {
      const memberResponses = teamResponses.get(member.id)
      if (memberResponses && isStandupComplete(memberResponses)) {
        completed++
      }
    }
    return teamMembers.length > 0 ? completed / teamMembers.length : 0
  }, [teamResponses, teamMembers])

  const blockers = allResponses.filter(
    (r) => r.question === 'blockers' && r.answer.trim() !== ''
  )

  const digest = useMemo(() => {
    return generateStandupDigest(allResponses, teamMembers, currentDate)
  }, [allResponses, teamMembers, currentDate])

  return (
    <div className="space-y-6">
      {/* Header with completion stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Async Standup — {currentDate}</h2>
          <p className="text-sm text-muted-foreground">
            Answer your standup questions anytime, no meeting required
          </p>
        </div>
        <Badge variant={myCompletion ? 'default' : 'secondary'}>
          {myCompletion ? 'All done!' : `${teamMembers.length} team members`}
        </Badge>
      </div>

      {/* Team completion progress */}
      <Card>
        <CardHeader>
          <CardTitle>Team Progress</CardTitle>
          <CardDescription>
            {Math.round(teamCompletionRate * 100)}% of team has completed their standup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={teamCompletionRate * 100} className="h-3" />
          <div className="mt-3 flex flex-wrap gap-2">
            {teamMembers.map((member) => {
              const memberResponses = teamResponses.get(member.id)
              const isComplete = memberResponses && isStandupComplete(memberResponses)
              const isCurrentUser = member.id === currentUserId
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                    isCurrentUser
                      ? 'bg-primary/20 ring-1 ring-primary'
                      : isComplete
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <User className="h-4 w-4" />
                  <span>{member.name}</span>
                  {isComplete && <CheckCircle className="h-3 w-3 text-green-500" />}
                  {isCurrentUser && <span className="text-xs">(you)</span>}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Input Section */}
      {!myCompletion && (
        <Card>
          <CardHeader>
            <CardTitle>Your Standup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q) => {
              const alreadyAnswered = myResponses[q.id] !== null
              return (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{q.label}</Label>
                    {alreadyAnswered && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Answered
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    placeholder={q.placeholder}
                    value={responses[q.id]}
                    onChange={(e) =>
                      setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    rows={3}
                    disabled={alreadyAnswered || isSubmitting}
                  />
                  {!alreadyAnswered && (
                    <Button
                      size="sm"
                      onClick={() => submitQuestion(q.id)}
                      disabled={isSubmitting || !responses[q.id].trim()}
                    >
                      Submit
                    </Button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Digest / Results */}
      {allResponses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Standup Digest</CardTitle>
            <CardDescription>{digest.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Blockers */}
            {blockers.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Blockers ({blockers.length})
                </h4>
                <div className="space-y-2">
                  {blockers.map((b) => (
                    <div key={b.id} className="text-sm p-2 bg-red-500/5 border border-red-500/20 rounded">
                      <span className="font-medium">{b.userName}:</span> {b.answer}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Highlights */}
            {digest.highlights.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Highlights</h4>
                <div className="space-y-2">
                  {digest.highlights.map((h, i) => (
                    <div key={i} className="text-sm p-2 bg-green-500/5 border border-green-500/20 rounded">
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {digest.actionItems.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Action Items</h4>
                <div className="space-y-2">
                  {digest.actionItems.map((item, i) => (
                    <div key={i} className="text-sm p-2 bg-yellow-500/5 border border-yellow-500/20 rounded">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Responses */}
            <Separator />
            <div>
              <h4 className="font-medium mb-2">All Responses</h4>
              <div className="space-y-3">
                {teamMembers.map((member) => {
                  const memberResponses = teamResponses.get(member.id)
                  if (!memberResponses) return null

                  const hasAny = memberResponses.yesterday || memberResponses.today || memberResponses.blockers
                  if (!hasAny) return null

                  return (
                    <div key={member.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">
                          {member.name}
                          {member.id === currentUserId && ' (you)'}
                        </span>
                      </div>
                      <div className="ml-6 mt-1 space-y-1">
                        {memberResponses.yesterday && (
                          <p><strong>Yesterday:</strong> {memberResponses.yesterday.answer}</p>
                        )}
                        {memberResponses.today && (
                          <p><strong>Today:</strong> {memberResponses.today.answer}</p>
                        )}
                        {memberResponses.blockers && (
                          <p><strong>Blockers:</strong> {memberResponses.blockers.answer || 'None'}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
