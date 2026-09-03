'use client'

import { useState, useEffect } from 'react'
import { Brain, Check, X, Sparkle, Target, Calendar as CalendarIcon, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { aiService, type AIRecommendation } from '@/lib/ai'
import type { Task, List, TaskLog } from '@/types'
import { toast } from 'sonner'

interface AIRecommendationsProps {
  tasks: Task[]
  lists: List[]
  logs?: TaskLog[]
  maxRecommendations?: number
}

export function AIRecommendations({
  tasks,
  lists,
  logs = [],
  maxRecommendations = 5,
}: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setLoading(true)
        const recs = await aiService.getRecommendations({
          tasks,
          user: {
            energyLevel: 'medium',
            availableTimeMinutes: 480,
          },
          history: logs,
        })
        setRecommendations(recs.slice(0, maxRecommendations))
      } catch (error) {
        console.error('Failed to load AI recommendations:', error)
        toast.error('Failed to load AI recommendations')
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
    // Poll for new recommendations every 5 minutes
    const interval = setInterval(fetchRecommendations, 300000)
    return () => clearInterval(interval)
  }, [tasks, lists, logs, maxRecommendations])

  const handleAccept = async (rec: AIRecommendation) => {
    try {
      await executeRecommendation(rec)
      setRecommendations(prev => prev.filter(r => r.id !== rec.id))
      toast.success(`${rec.title} applied`)
    } catch (error) {
      console.error('Failed to apply recommendation:', error)
      toast.error('Failed to apply recommendation')
    }
  }

  const handleDismiss = (id: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== id))
  }

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (recommendations.length === 0) {
    return null
  }

  const iconMap: Record<string, React.ReactNode> = {
    priority: <Target className="h-4 w-4 text-red-500" />,
    schedule: <CalendarIcon className="h-4 w-4 text-blue-500" />,
    breakdown: <Brain className="h-4 w-4 text-purple-500" />,
    automation: <Sparkle className="h-4 w-4 text-yellow-500" />,
    batch: <TrendingUp className="h-4 w-4 text-green-500" />,
    delegate: <CalendarIcon className="h-4 w-4 text-orange-500" />,
    energy: <Zap className="h-4 w-4 text-amber-500" />,
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Recommendations
        </CardTitle>
        <CardDescription>
          AI-powered suggestions based on your work patterns and task data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-lg bg-card/50 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">{iconMap[rec.type] || <Brain className="h-4 w-4" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{rec.title}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {rec.type}
                    </Badge>
                    {rec.confidence > 0 && (
                      <Badge
                        variant="outline"
                        className={
                          rec.confidence > 0.8 ? 'bg-green-500/10 text-green-500' :
                          rec.confidence > 0.6 ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-gray-500/10 text-gray-500'
                        }
                      >
                        {Math.round(rec.confidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {rec.description}
                  </p>
                  {rec.aiReason && (
                    <p className="text-xs text-muted-foreground/70 mt-2 italic">
                      AI: {rec.aiReason}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(rec)}
                      className="gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDismiss(rec.id)}
                    >
                      <X className="h-3 w-3" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Execute a recommendation based on its type
 */
async function executeRecommendation(
  rec: AIRecommendation
): Promise<void> {
  switch (rec.action.type) {
    case 'create_task': {
      const payload = rec.action.payload as Record<string, unknown>
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name || 'New Task',
          description: payload.description || '',
          priority: payload.priority || 'none',
          list_id: payload.list_id || 'inbox',
          estimate: payload.estimate || null,
        }),
      })
      break
    }

    case 'update_task': {
      const payload = rec.action.payload as Record<string, unknown>
      const taskIds = payload.task_ids as string[]
      for (const id of taskIds) {
        await fetch(`/api/tasks/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rec.action.payload),
        })
      }
      break
    }

    case 'navigate':
      // Navigation handled client-side
      break
  }
}
