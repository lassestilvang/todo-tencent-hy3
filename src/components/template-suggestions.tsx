'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  suggestTemplates,
  type TemplateSuggestion,
} from '@/lib/template-suggestions'
import { toast } from 'sonner'
import type { Task } from '@/types'

interface TemplateSuggestionsProps {
  tasks: Task[]
}

export function TemplateSuggestions({ tasks }: TemplateSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSuggestions() {
      try {
        setLoading(true)
        // Existing templates are filtered out of the
        // suggestions, so fetch them first.
        const response = await fetch('/api/templates')
        const existing: { name: string }[] = response.ok
          ? (await response.json()).templates ?? []
          : []
        setSuggestions(suggestTemplates(tasks, existing))
      } catch (error) {
        console.error('Failed to load template suggestions:', error)
        setSuggestions(suggestTemplates(tasks))
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [tasks])

  const handleCreate = async (suggestion: TemplateSuggestion) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.name,
          priority: suggestion.priority,
          estimate: suggestion.estimate,
          listId: suggestion.listId,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to create template')
      }
      toast.success(`Template "${suggestion.name}" created`)
      setSuggestions((prev) =>
        prev.filter((s) => s.name !== suggestion.name)
      )
    } catch (error) {
      console.error('Failed to create template:', error)
      toast.error('Failed to create template')
    }
  }

  const handleDismiss = (name: string) => {
    setDismissed((prev) => new Set([...prev, name]))
  }

  if (loading) {
    return null
  }

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissed.has(s.name)
  )

  if (visibleSuggestions.length === 0) {
    return null
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-foreground">
            Save time with templates
          </h4>
        </div>
        <div className="space-y-2">
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.name}
              className="flex items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {suggestion.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {suggestion.occurrences} times
                  {suggestion.estimate
                    ? ` · ~${suggestion.estimate} min`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreate(suggestion)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Create Template
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground/50 hover:text-muted-foreground"
                  onClick={() => handleDismiss(suggestion.name)}
                  aria-label={`Dismiss template suggestion for ${suggestion.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
