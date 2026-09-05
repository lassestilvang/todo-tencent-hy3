'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  X,
  Zap,
  Calendar,
  Clock,
  Flag,
  List,
  RotateCcw,
  Compass,
  Eye,
  Keyboard,
  Mic,
  MicOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { parseNaturalLanguage, generatePreview } from '@/lib/nlp'
import { createTask, getLists } from '@/lib/tasks-client'
import { handleClearCompleted } from '@/lib/actions'
import { toast } from 'sonner'
import {
  COMMANDS,
  findCommand,
  getRecentCommands,
  loadCommandHistory,
  parseCommandInput,
  recordCommandUsage,
  searchCommands,
  suggestCommands,
  toCommandContext,
  type CommandCategory,
  type CommandUsage,
  type PaletteCommand,
} from '@/lib/command-palette'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated?: () => void
  onNewTask: () => void
  onSearch: () => void
  onShortcuts: () => void
}

const COMMAND_ICONS: Record<CommandCategory, LucideIcon> = {
  Navigation: Compass,
  Task: Zap,
  View: Eye,
  Help: Keyboard,
}

/** Recent commands beyond the suggestions are worth listing. */
const RECENT_LIMIT = 4

/** Suggested commands shown when the palette opens. */
const SUGGESTION_LIMIT = 4

export function CommandPalette({
  isOpen,
  onClose,
  onTaskCreated,
  onNewTask,
  onSearch,
  onShortcuts,
}: CommandPaletteProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parseNaturalLanguage> | null>(null)
  const [lists, setLists] = useState<{ id: string; name: string }[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [history, setHistory] = useState<CommandUsage[]>(loadCommandHistory)
  const inputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)

  // --- Voice input ---
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      toast.error('Voice input is not supported in this browser')
      return
    }

    const SpeechRecognitionClass = (window as unknown as {
      SpeechRecognition?: typeof SpeechRecognition
      webkitSpeechRecognition?: typeof SpeechRecognition
    }).SpeechRecognition ?? (window as unknown as {
      SpeechRecognition?: typeof SpeechRecognition
      webkitSpeechRecognition?: typeof SpeechRecognition
    }).webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      toast.error('Voice input is not supported in this browser')
      return
    }

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.trim()
      if (transcript) {
        setInput(transcript)
        setSelectedIndex(0)
      }
    }

    recognition.onerror = () => {
      toast.error('Voice recognition error')
      setIsListening(false)
    }

    recognition.onend = () => {
      if (mountedRef.current) {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  // Fetch lists on mount
  useEffect(() => {
    mountedRef.current = true

    if (isOpen) {
      const fetchLists = async () => {
        try {
          const allLists = await getLists()
          if (mountedRef.current) {
            setLists(allLists)
          }
        } catch (error) {
          console.error('Failed to fetch lists:', error)
        }
      }
      fetchLists()
    }

    return () => {
      mountedRef.current = false
      // Stop speech recognition if the palette closes while listening
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      setIsListening(false)
    }
  }, [isOpen])

  // "> command", "go to analytics", "show completed"…
  const parsedInput = useMemo(() => parseCommandInput(input), [input])

  // Parse natural-language task input as the user types
  useEffect(() => {
    if (parsedInput.mode === 'task' && input.trim()) {
      const parsedResult = parseNaturalLanguage(input, { lists })
      if (mountedRef.current) {
        setParsed(parsedResult)
        setShowPreview(true)
      }
    } else if (mountedRef.current) {
      setParsed(null)
      setShowPreview(false)
    }
  }, [input, lists, parsedInput.mode])

  // Context-aware suggestions, re-ranked by usage history
  const suggestions = useMemo(
    () =>
      suggestCommands(toCommandContext(new Date()), {
        history,
        limit: SUGGESTION_LIMIT,
      }),
    [history],
  )

  const commandResults = useMemo(() => {
    if (parsedInput.mode !== 'command') {
      return []
    }
    return parsedInput.query ? searchCommands(parsedInput.query) : suggestions
  }, [parsedInput, suggestions])

  // Recent commands not already covered by the suggestions
  const recentEntries = useMemo(() => {
    const suggested = new Set(suggestions.map((command) => command.id))
    return getRecentCommands(history, RECENT_LIMIT)
      .map((usage) => ({ usage, command: findCommand(usage.commandId, COMMANDS) }))
      .filter(
        (entry): entry is { usage: CommandUsage; command: PaletteCommand } =>
          entry.command !== undefined && !suggested.has(entry.command.id),
      )
  }, [history, suggestions])

  // The list the arrow keys move through: command results
  // while in command mode, otherwise the suggestions and
  // recent commands shown when the input is empty.
  const navigableItems = useMemo(() => {
    if (parsedInput.mode === 'command') {
      return commandResults
    }
    if (input) {
      return []
    }
    return [...suggestions, ...recentEntries.map((entry) => entry.command)]
  }, [parsedInput.mode, commandResults, input, suggestions, recentEntries])

  // Clamp rather than reset so no effect is needed.
  const safeIndex = Math.min(selectedIndex, Math.max(0, navigableItems.length - 1))

  const handleCreateTask = useCallback(async () => {
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
      setSelectedIndex(0)
      onTaskCreated?.()

      // Close after short delay to show success
      setTimeout(() => onClose(), 300)
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }, [parsed, onTaskCreated, onClose])

  const runCommand = useCallback(
    async (command: PaletteCommand) => {
      setHistory(recordCommandUsage(command.id))

      switch (command.id) {
        case 'goto.today':
          router.push('/today')
          break
        case 'goto.next7':
          router.push('/next7')
          break
        case 'goto.upcoming':
          router.push('/upcoming')
          break
        case 'goto.all':
          router.push('/all')
          break
        case 'view.showCompleted':
          router.push('/all?completed=true')
          break
        case 'view.hideCompleted':
          router.push('/all?completed=false')
          break
        case 'goto.analytics':
          router.push('/analytics')
          break
        case 'goto.workflows':
          router.push('/workflows')
          break
        case 'goto.timeblock':
          router.push('/timeblock')
          break
        case 'goto.habits':
          router.push('/habits')
          break
        case 'goto.focus':
          router.push('/focus')
          break
        case 'goto.meeting':
          router.push('/meeting')
          break
        case 'goto.settings':
          router.push('/settings')
          break
        case 'goto.archealogy':
          router.push('/all')
          break
        case 'goto.digest':
          router.push('/digest')
          break
        case 'goto.standup':
          router.push('/standup')
          break
        case 'goto.velocity':
          router.push('/team-velocity')
          break
        case 'task.create':
          onNewTask()
          break
        case 'task.search':
          onSearch()
          break
        case 'help.shortcuts':
          onShortcuts()
          break
        case 'task.clearCompleted':
          if (
            window.confirm('Are you sure you want to delete all completed tasks?')
          ) {
            await handleClearCompleted()
            toast.success('Completed tasks cleared')
          }
          break
        default:
          break
      }

      onClose()
    },
    [router, onNewTask, onSearch, onShortcuts, onClose],
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'Enter': {
          const selected = navigableItems[safeIndex]
          if (parsedInput.mode === 'command' && selected) {
            runCommand(selected)
          } else if (parsed && parsed.name) {
            handleCreateTask()
          }
          break
        }
        case 'ArrowUp':
          if (navigableItems.length > 0) {
            e.preventDefault()
            setSelectedIndex((prev) =>
              prev <= 0 ? navigableItems.length - 1 : prev - 1,
            )
          }
          break
        case 'ArrowDown':
          if (navigableItems.length > 0) {
            e.preventDefault()
            setSelectedIndex((prev) =>
              prev >= navigableItems.length - 1 ? 0 : prev + 1,
            )
          }
          break
        case 'Tab': {
          if (parsedInput.mode === 'command') {
            const top = commandResults[0]
            if (top) {
              e.preventDefault()
              setInput(top.title)
              setSelectedIndex(0)
            }
          } else if (parsed) {
            e.preventDefault()
            // Auto-complete the suggestion
            setInput(generatePreview(parsed))
            setSelectedIndex(0)
          }
          break
        }
      }
    },
    [
      isOpen,
      onClose,
      navigableItems,
      safeIndex,
      parsedInput.mode,
      parsed,
      commandResults,
      runCommand,
      handleCreateTask,
    ],
  )

  const renderCommand = (
    command: PaletteCommand,
    index: number,
    usage?: CommandUsage,
  ) => {
    const Icon = COMMAND_ICONS[command.category]
    const isSelected = safeIndex === index
    return (
      <button
        key={command.id}
        type="button"
        onClick={() => runCommand(command)}
        onMouseEnter={() => setSelectedIndex(index)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
          isSelected ? 'bg-accent' : ''
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{command.title}</span>
        {usage && usage.count > 1 && (
          <span className="text-xs text-muted-foreground/70">
            {usage.count}×
          </span>
        )}
        <span className="text-xs text-muted-foreground/50">
          {command.category}
        </span>
      </button>
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    setSelectedIndex(0)
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
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Don't close if clicking on preview
                  setTimeout(() => {
                    if (!showPreview) onClose()
                  }, 100)
                }}
                placeholder='Type a task naturally, or a command: "go to analytics", "> show completed"'
                className="w-full pl-10 pr-12 py-3 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-lg placeholder:text-muted-foreground/50"
                autoFocus
              />
              {input && (
                <button
                  onClick={() => {
                    setInput('')
                    setSelectedIndex(0)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear input"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              {!input && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                    isListening
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-muted-foreground hover:text-foreground'
                  }}`}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
            </div>

            {/* Quick help */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground/70">
              <kbd className="px-2 py-1 bg-accent rounded">&gt;command</kbd> run a
              command
              <kbd className="px-2 py-1 bg-accent rounded">#tag</kbd> list
              <kbd className="px-2 py-1 bg-accent rounded">@list</kbd> list
              <kbd className="px-2 py-1 bg-accent rounded">!high</kbd> priority
              <kbd className="px-2 py-1 bg-accent rounded">~30m</kbd> estimate
              <kbd className="px-2 py-1 bg-accent rounded">tomorrow</kbd> date
              <kbd className="px-2 py-1 bg-accent rounded">3pm</kbd> time
            </div>
          </div>

          {/* Command results */}
          {parsedInput.mode === 'command' && (
            <div className="border-t p-4">
              {commandResults.length > 0 ? (
                <div className="max-h-[50vh] space-y-1 overflow-auto">
                  {commandResults.map((command, index) =>
                    renderCommand(command, index),
                  )}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No commands match &ldquo;{parsedInput.query}&rdquo; — try
                  &ldquo;go to analytics&rdquo; or &ldquo;&gt; search&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Parsed Preview */}
          {showPreview && parsed && parsedInput.mode === 'task' && (
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

          {/* Suggestions and recent commands when empty */}
          {!input && (
            <div className="border-t p-4 max-h-[50vh] overflow-auto">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Suggested for you
              </p>
              <div className="mb-4 space-y-1">
                {suggestions.map((command, index) =>
                  renderCommand(command, index),
                )}
              </div>

              {recentEntries.length > 0 && (
                <>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Recent
                  </p>
                  <div className="mb-4 space-y-1">
                    {recentEntries.map((entry, index) =>
                      renderCommand(
                        entry.command,
                        suggestions.length + index,
                        entry.usage,
                      ),
                    )}
                  </div>
                </>
              )}

              <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                Try typing
              </p>
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
                    onClick={() => {
                      setInput(example)
                      setSelectedIndex(0)
                    }}
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
