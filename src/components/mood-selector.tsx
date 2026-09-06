'use client'

import { MOOD_EMOJI, MOOD_LABELS, type TaskMood } from '@/types'
import { cn } from '@/lib/utils'

const MOODS: { value: TaskMood; label: string; emoji: string }[] = [
  { value: 'fun', label: 'Fun', emoji: '🎉' },
  { value: 'grind', label: 'Grind', emoji: '😩' },
  { value: 'urgent', label: 'Urgent', emoji: '🔥' },
  { value: 'thinking', label: 'Thinking', emoji: '🤔' },
  { value: 'learn', label: 'Learning', emoji: '🧠' },
  { value: 'calm', label: 'Calm', emoji: '☕' },
]

interface MoodSelectorProps {
  /** Name for the hidden form input (for server-action forms). */
  name?: string
  /** Current mood value, if any. */
  value?: TaskMood | null
  /** Called with the selected mood (or null to clear). */
  onChange?: (mood: TaskMood | null) => void
  /** Whether the selector is disabled. */
  disabled?: boolean
  /** Show as a compact badge set (inline) vs. a labeled row. */
  compact?: boolean
}

/**
 * Emoji mood selector. Renders as a row of tappable emoji badges.
 * When used in a form, also renders a hidden input so the value
 * survives a full-page server-action submission.
 */
export function MoodSelector({
  name = 'mood',
  value,
  onChange,
  disabled = false,
  compact = false,
}: MoodSelectorProps) {
  const selected = value ?? null

  return (
    <div className={cn('flex flex-wrap gap-1.5', compact ? '' : 'flex-col')}>
      {!compact && (
        <span className="text-muted-foreground text-xs font-semibold uppercase">
          Mood
        </span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((mood) => {
          const isActive = selected === mood.value
          return (
            <button
              key={mood.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(isActive ? null : mood.value)}
              aria-label={isActive ? `Clear ${mood.label} mood` : `Set mood to ${mood.label}`}
              aria-pressed={isActive}
              title={mood.label}
              className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg',
                'border text-base transition-all duration-150',
                isActive
                  ? 'border-primary bg-primary/20 ring-2 ring-primary scale-110'
                  : 'border-border bg-background/40 hover:border-primary/50 hover:scale-105',
                disabled && 'cursor-not-allowed opacity-40',
              )}
            >
              <span>{mood.emoji}</span>
              <input
                type="hidden"
                name={name}
                value={isActive ? mood.value : ''}
                aria-hidden={!isActive}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Display the mood emoji as a small badge (read-only context). */
export function MoodBadge({ mood }: { mood: TaskMood | null | undefined }) {
  if (!mood) return null
  return (
    <span
      title={MOOD_LABELS[mood]}
      aria-label={MOOD_LABELS[mood]}
      className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-background/60 text-xs"
    >
      {MOOD_EMOJI[mood]}
    </span>
  )
}
