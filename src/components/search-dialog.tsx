'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Task } from '@/types'
import Link from 'next/link'
import { cn, formatDisplayDate } from '@/lib/utils'
import { Loader2, X } from 'lucide-react'
import { TaskCheckbox } from '@/components/task-checkbox'

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  )
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={`${part}-${i}`}
            className="bg-primary/20 text-primary rounded-sm px-0.5 font-bold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Search failed')
  return r.json()
}

const DEBOUNCE_MS = 300

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { push } = useRouter()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setSelectedIndex(-1)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const {
    data: results = [],
    isLoading,
    error,
  } = useSWR<Task[]>(
    debouncedQuery.length >= 2
      ? `/api/search?q=${encodeURIComponent(debouncedQuery)}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (results.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        const task = results[selectedIndex]
        push(`/task/${task.id}`)
        onOpenChange(false)
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    },
    [results, selectedIndex, onOpenChange, push]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect bg-card/15 rounded-2xl border p-6 shadow-2xl sm:max-w-2xl">
        <div className="relative">
          <Input
            placeholder="Search tasks..."
            aria-label="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-background/50 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-12 rounded-xl px-4 pr-10 text-lg transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        )}
        {results.length > 0 && (
          <div className="bg-accent/5 border-border/5 mt-4 max-h-96 space-y-1.5 overflow-auto rounded-xl border p-1.5">
            {results.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  'hover:bg-accent/40 flex items-center gap-3 rounded-lg p-3 transition-colors duration-150',
                  index === selectedIndex &&
                    'bg-accent/50 border-primary border-l-2'
                )}
              >
                <TaskCheckbox
                  taskId={task.id}
                  checked={task.completed}
                  taskName={task.name}
                />
                <Link
                  href={`/task/${task.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between"
                  onClick={() => onOpenChange(false)}
                >
                  <p
                    className={cn(
                      'text-foreground/90 truncate font-medium',
                      task.completed && 'line-through opacity-60'
                    )}
                  >
                    <HighlightText text={task.name} query={debouncedQuery} />
                  </p>
                  {task.date && (
                    <p className="text-muted-foreground ml-2 text-xs font-medium">
                      {formatDisplayDate(task.date)}
                    </p>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="text-destructive py-8 text-center font-medium">
            Failed to search. Please try again.
          </p>
        )}
        {!error &&
          debouncedQuery.length >= 2 &&
          !isLoading &&
          results.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center py-8 text-center">
              <div className="bg-muted mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-foreground/80 text-lg font-semibold">
                No tasks found
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Try a different search term
              </p>
            </div>
          )}
      </DialogContent>
    </Dialog>
  )
}
