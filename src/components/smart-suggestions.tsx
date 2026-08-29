'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, X, ChevronRight, AlertTriangle, Zap, ListTodo, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Suggestion, generateSmartSuggestions, dismissSuggestion, isSuggestionDismissed } from '@/lib/smart-suggestions'
import type { Task, List } from '@/lib/db/schema'

interface SmartSuggestionsProps {
  tasks: Task[]
  lists: List[]
  view?: string
}

const ICONS: Record<Suggestion['type'], React.ReactNode> = {
  schedule: <Calendar className="h-5 w-5 text-blue-500" />,
  reschedule: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  priority: <Zap className="h-5 w-5 text-red-500" />,
  list: <ListTodo className="h-5 w-5 text-purple-500" />,
  breakdown: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  habit: <Zap className="h-5 w-5 text-green-500" />,
}

export function SmartSuggestions({ tasks, lists, view = 'today' }: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const incompleteTasks = tasks.filter((t) => !t.completed)

  const generateAndFilter = useCallback(() => {
    if (incompleteTasks.length === 0) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const allSuggestions = generateSmartSuggestions(tasks, lists, incompleteTasks)
    const filtered = allSuggestions.filter((s) => !isSuggestionDismissed(s.id))
    setSuggestions(filtered)
    setIsLoading(false)
  }, [tasks, lists, incompleteTasks])

  useEffect(() => {
    generateAndFilter()
  }, [generateAndFilter])

  const handleDismiss = (suggestionId: string) => {
    dismissSuggestion(suggestionId)
    setDismissedIds((prev) => new Set([...prev, suggestionId]))
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  const handleAction = (suggestion: Suggestion) => {
    // Handle the action based on type
    switch (suggestion.action.type) {
      case 'navigate':
        if (suggestion.action.payload?.view) {
          window.location.href = `/${suggestion.action.payload.view}`
        }
        break
      case 'create_task':
        // Open command palette or create task form with pre-filled data
        // For now, we'll dispatch a custom event that the command palette can listen to
        window.dispatchEvent(
          new CustomEvent('smart-suggestion-create-task', {
            detail: suggestion.action.payload,
          })
        )
        break
      case 'update_task':
        // Dispatch event for bulk update
        window.dispatchEvent(
          new CustomEvent('smart-suggestion-update-tasks', {
            detail: suggestion.action.payload,
          })
        )
        break
    }
    handleDismiss(suggestion.id)
  }

  if (isLoading || suggestions.length === 0) {
    return null
  }

  return (
    <div className="mb-6 animate-slide-down">
      {suggestions.map((suggestion) => (
        <Card
          key={suggestion.id}
          className={cn(
            'border-l-4 transition-all hover:shadow-lg',
            suggestion.priority === 'high' && 'border-l-primary',
            suggestion.priority === 'medium' && 'border-l-yellow-500',
            suggestion.priority === 'low' && 'border-l-green-500'
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {ICONS[suggestion.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-foreground">{suggestion.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                  </div>
                  {suggestion.dismissible && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground/50 hover:text-muted-foreground"
                      onClick={() => handleDismiss(suggestion.id)}
                      aria-label="Dismiss suggestion"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAction(suggestion)}
                    className="gap-1"
                  >
                    {suggestion.action.label}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                    {suggestion.type}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Client-side hook for using suggestions in other components
export function useSmartSuggestions(tasks: Task[], lists: List[]) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const incompleteTasks = tasks.filter((t) => !t.completed)
    if (incompleteTasks.length === 0) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const allSuggestions = generateSmartSuggestions(tasks, lists, incompleteTasks)
    const filtered = allSuggestions.filter((s) => !isSuggestionDismissed(s.id))
    setSuggestions(filtered)
    setIsLoading(false)
  }, [tasks, lists])

  const dismiss = (id: string) => {
    dismissSuggestion(id)
    setSuggestions((prev) => prev.filter((s) => s.id !== id))
  }

  return { suggestions, isLoading, dismiss }
}