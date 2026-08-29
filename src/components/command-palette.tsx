'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useKeyPress } from '@/lib/hooks'
import { Search, X, Zap, Calendar, Clock, Flag, List, Tag, RotateCcw } from 'lucide-react'
import { parseNaturalLanguage, generatePreview } from '@/lib/nlp'
import { createTask, getLists } from '@/lib/tasks-client'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated?: () => void
}

export function CommandPalette({ isOpen, onClose, onTaskCreated }: CommandPaletteProps) {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parseNaturalLanguage> | null>(null)
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch lists on mount
  useEffect(() => {
    if (isOpen) {
      const fetchLists = async () => {
        try {
          const allLists = await getLists()
          setLists(allLists)
        } catch (error) {
          console.error('Failed to fetch lists:', error)
        }
      }
      fetchLists()
    }
  }, [isOpen])

  // Parse input as user types
  useEffect(() => {
    if (input.trim()) {
      const parsedResult = parseNaturalLanguage(input, { lists })
      setParsed(parsedResult)
      setShowPreview(true)
    } else {
      setParsed(null)
      setShowPreview(false)
    }
  }, [input, lists])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'Enter':
        if (parsed && parsed.name) {
          handleCreateTask()
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        // Could add history navigation here
        break
      case 'ArrowDown':
        e.preventDefault()
        // Could add history navigation here
        break
      case 'Tab':
        if (parsed) {
          e.preventDefault()
          // Auto-complete the suggestion
          setInput(generatePreview(parsed))
        }
        break
    }
  }, [isOpen, parsed, onClose])

  // Global key press for opening palette (Cmd/Ctrl + K)
  useKeyPress(['Meta', 'k'], () => {
    if (!isOpen) {
      // This would be handled by parent to open the palette
    }
  })

  const handleCreateTask = async () => {
    if (!parsed || !parsed.name) return

    try {
      await createTask({
        name: parsed.name,
        date: parsed.date,
        deadline: parsed.deadline,
        priority: parsed.priority,
        list_id: parsed.listId,
        estimate: parsed.estimate,
        recurring: parsed.recurring,
      })

      setInput('')
      setParsed(null)
      setShowPreview(false)
      onTaskCreated?.()

      // Close after short delay to show success
      setTimeout(() => onClose(), 300)
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl mx-4">
        <div className="glass-effect rounded-2xl shadow-2xl border overflow-hidden">
          {/* Input */}
          <div className="relative p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                  // Don't close if clicking on preview
                  setTimeout(() => {
                    if (!showPreview) onClose()
                  }, 100)
                }}
                placeholder='Type naturally: "Buy groceries tomorrow 5pm #personal !high ~30m"'
                className="w-full pl-10 pr-12 py-3 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-lg placeholder:text-muted-foreground/50"
                autoFocus
              />
              {input && (
                <button
                  onClick={() => setInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear input"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Quick help */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground/70">
              <kbd className="px-2 py-1 bg-accent rounded">#tag</kbd> list
              <kbd className="px-2 py-1 bg-accent rounded">@list</kbd> list
              <kbd className="px-2 py-1 bg-accent rounded">!high</kbd> priority
              <kbd className="px-2 py-1 bg-accent rounded">~30m</kbd> estimate
              <kbd className="px-2 py-1 bg-accent rounded">tomorrow</kbd> date
              <kbd className="px-2 py-1 bg-accent rounded">3pm</kbd> time
            </div>
          </div>

          {/* Parsed Preview */}
          {showPreview && parsed && (
            <div className="border-t p-4 bg-accent/20 animate-slide-down">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-medium text-sm">Parsed Preview</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Confidence: {Math.round(parsed.confidence * 100)}%
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {parsed.name && (
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{parsed.name}</span>
                  </div>
                )}
                {parsed.date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Due: {parsed.date}</span>
                  </div>
                )}
                {parsed.time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Time: {parsed.time}</span>
                  </div>
                )}
                {parsed.deadline && parsed.deadline !== parsed.date && (
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-muted-foreground" />
                    <span>Deadline: {parsed.deadline}</span>
                  </div>
                )}
                {parsed.priority && (
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-muted-foreground" />
                    <span>Priority: {parsed.priority}</span>
                  </div>
                )}
                {parsed.listId && (
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span>List: {parsed.listId}</span>
                  </div>
                )}
                {parsed.estimate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Estimate: ~{Math.floor(parsed.estimate / 60)}h {parsed.estimate % 60}m</span>
                  </div>
                )}
                {parsed.recurring && (
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    <span>Recurring: {parsed.recurring.replace('every_', '').replace('_', ' ')}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleCreateTask}
                  disabled={!parsed.name}
                  className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Create Task (Enter)
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Examples when empty */}
          {!input && (
            <div className="border-t p-4">
              <p className="text-sm text-muted-foreground mb-3">Try typing:</p>
              <div className="space-y-2 text-sm">
                {[
                  'Buy groceries tomorrow 5pm #personal !high ~30m',
                  'Finish report by Friday #work',
                  'Call mom @ 3pm tomorrow',
                  'Gym Mon Wed Fri 7am !high',
                  'Team meeting next Tuesday 10am #meetings',
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(example)}
                    className="w-full text-left p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors text-muted-foreground/80"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}