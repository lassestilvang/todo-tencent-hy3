'use client'

import { useState, useCallback } from 'react'
import {
  Mic,
  Copy,
  Trash2,
  Check,
  AlertCircle,
  User,
  Calendar,
  Clock,
  Flag,
  Zap,
  Download,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import type { ExtractedAction, MeetingActionExtraction } from '@/lib/meeting-actions'
import { actionToTask } from '@/lib/meeting-actions'

interface MeetingActionExtractorProps {
  /** Optional initial transcript text */
  initialTranscript?: string
  /** Called when tasks are imported */
  onImportTasks?: (tasks: ReturnType<typeof actionToTask>[]) => void
}

/**
 * Meeting-to-Action Extractor
 *
 * Paste meeting transcripts, notes, or recordings and the component
 * will extract actionable items with assignees, deadlines, estimates,
 * and priority levels — ready to be imported as tasks.
 *
 * Features:
 * - Real-time action item extraction from natural language
 * - Highlights assignees, deadlines, and time estimates
 * - Confidence scores for each extracted action
 * - One-click import into task database
 * - Export to CSV for sharing
 */
export function MeetingActionExtractor({
  initialTranscript = '',
  onImportTasks,
}: MeetingActionExtractorProps) {
  const [transcript, setTranscript] = useState(initialTranscript)
  const [extraction, setExtraction] = useState<MeetingActionExtraction | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const handleExtract = useCallback(async () => {
    if (!transcript.trim()) {
      toast.error('Please enter a meeting transcript')
      return
    }

    setIsExtracting(true)
    try {
      // Use the API route for extraction
      const response = await fetch('/api/meeting-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, importTasks: false }),
      })

      if (!response.ok) {
        throw new Error('Extraction failed')
      }

      const data = await response.json()
      setExtraction(data.extraction)
      toast.success(`Found ${data.count} action items`)
    } catch (error) {
      toast.error('Failed to extract actions')
    } finally {
      setIsExtracting(false)
    }
  }, [transcript])

  const handleImportAll = () => {
    if (!extraction || extraction.actions.length === 0) return

    const tasks = extraction.actions.map((a) => actionToTask(a))
    onImportTasks?.(tasks)
    toast.success(`Imported ${tasks.length} tasks`)
  }

  const handleImportOne = (action: ExtractedAction) => {
    const task = actionToTask(action)
    onImportTasks?.([task])
    toast.success(`Imported: "${task.name}"`)
  }

  const handleCopyText = async () => {
    if (!extraction) return
    try {
      await navigator.clipboard.writeText(
        extraction.actions
          .map((a) => `• ${a.text}${a.assignee ? ` (@${a.assignee})` : ''}${a.deadline ? ` — due ${a.deadline}` : ''}${a.estimate ? ` ~${a.estimate}min` : ''}`)
          .join('\n')
      )
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      toast.success('Action items copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleExportCSV = () => {
    if (!extraction || extraction.actions.length === 0) return

    const csv = [
      ['Text', 'Assignee', 'Deadline', 'Estimate (min)', 'Priority', 'Confidence'],
      ...extraction.actions.map((a) => [
        `"${a.text}"`,
        `"${a.assignee || ''}"`,
        `"${a.deadline || ''}"`,
        a.estimate?.toString() || '',
        a.priority,
        a.confidence.toFixed(2),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'meeting-actions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    setTranscript('')
    setExtraction(null)
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'medium':
        return <Flag className="h-4 w-4 text-yellow-500" />
      case 'low':
        return <Flag className="h-4 w-4 text-green-500" />
      default:
        return null
    }
  }

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive' as const
      case 'medium':
        return 'warning' as const
      case 'low':
        return 'success' as const
      default:
        return 'secondary' as const
    }
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="glass-effect">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Meeting Action Extractor
          </CardTitle>
          <CardDescription>
            Paste meeting transcripts, notes, or recordings to extract
            actionable tasks with assignees, deadlines, and estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="transcript">Meeting Transcript</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your meeting notes here...
Example: Alex: Let's review the Q4 roadmap. Sarah, can you prepare the marketing deck by Friday? John, please book the client demo room for next week."
              rows={8}
              className="resize-y"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleExtract}
              disabled={isExtracting || !transcript.trim()}
              className="flex-1"
            >
              {isExtracting ? (
                <>Analyzing... </>
              ) : (
                <>Extract Actions</>
              )}
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={!transcript && !extraction}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {extraction && (
        <Card className="glass-effect">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Extracted Actions ({extraction.actions.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyText}>
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleImportAll} disabled={extraction.actions.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Import All
                </Button>
              </div>
            </div>
            {extraction.meetingTitle && (
              <CardDescription>
                Meeting: {extraction.meetingTitle} · {extraction.participantCount} participants
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {/* Confidence */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Overall confidence</span>
                <span>{Math.round(extraction.confidence * 100)}%</span>
              </div>
              <Progress value={extraction.confidence * 100} className="h-2" />
            </div>

            {/* Action Items List */}
            <div className="space-y-3">
              {extraction.actions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No action items found. Try adding more specific verbs like
                  "review", "prepare", "schedule", or "follow up".
                </p>
              ) : (
                extraction.actions.map((action, i) => (
                  <ActionItemCard
                    key={`action-${i}`}
                    action={action}
                    onImport={() => handleImportOne(action)}
                  />
                ))
              )}
            </div>

            {/* Detected Action Verbs */}
            {extraction.actionVerbs.length > 0 && (
              <div className="mt-6">
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground mb-2">
                  Action verbs detected:
                </p>
                <div className="flex flex-wrap gap-1">
                  {extraction.actionVerbs.map((verb) => (
                    <Badge key={verb} variant="outline" className="text-xs">
                      {verb}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ActionItemCard({
  action,
  onImport,
}: {
  action: ExtractedAction
  onImport: () => void
}) {
  return (
    <Card className="border-l-2" style={{
      borderLeftColor: action.priority === 'high' ? '#ef4444' :
        action.priority === 'medium' ? '#eab308' :
        action.priority === 'low' ? '#22c55e' : '#9ca3af'
    }}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-medium mb-1">{action.text}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {action.assignee && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{action.assignee}</span>
                </div>
              )}
              {action.deadline && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{action.deadline}</span>
                </div>
              )}
              {action.estimate && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{action.estimate} min</span>
                </div>
              )}
              {action.priority !== 'none' && getPriorityIcon(action.priority)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getPriorityVariant(action.priority)} className="text-xs">
              {action.priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {Math.round(action.confidence * 100)}%
            </Badge>
            <Button size="sm" variant="ghost" onClick={onImport}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case 'high':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'medium':
      return <Flag className="h-4 w-4 text-yellow-500" />
    case 'low':
      return <Flag className="h-4 w-4 text-green-500" />
    default:
      return null
  }
}

function getPriorityVariant(priority: string) {
  switch (priority) {
    case 'high':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}
