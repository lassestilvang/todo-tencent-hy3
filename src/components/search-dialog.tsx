'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Task } from '@/types'
import Link from 'next/link'
import { cn, formatDisplayDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { TaskCheckbox } from '@/components/task-checkbox'

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
  const router = useRouter()
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
        router.push(`/task/${task.id}`)
        onOpenChange(false)
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    },
    [results, selectedIndex, onOpenChange, router]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <Input
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-12 text-lg"
          autoFocus
        />
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        )}
        {results.length > 0 && (
          <div className="mt-4 max-h-96 space-y-1 overflow-auto">
            {results.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  'hover:bg-accent flex items-center gap-3 rounded-lg p-3',
                  index === selectedIndex && 'bg-accent'
                )}
              >
                <TaskCheckbox taskId={task.id} checked={task.completed} />
                <Link
                  href={`/task/${task.id}`}
                  className="flex min-w-0 flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  <p
                    className={cn(
                      'truncate',
                      task.completed && 'line-through opacity-60'
                    )}
                  >
                    {task.name}
                  </p>
                  {task.date && (
                    <p className="text-muted-foreground text-xs">
                      {formatDisplayDate(task.date)}
                    </p>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="text-destructive py-8 text-center">
            Failed to search. Please try again.
          </p>
        )}
        {!error &&
          debouncedQuery.length >= 2 &&
          !isLoading &&
          results.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">
              No tasks found
            </p>
          )}
      </DialogContent>
    </Dialog>
  )
}
