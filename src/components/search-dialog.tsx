'use client'

import useSWR from 'swr'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Task } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { cn, formatDisplayDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const DEBOUNCE_MS = 300

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [], isLoading } = useSWR<Task[]>(
    debouncedQuery.length >= 2
      ? `/api/search?q=${encodeURIComponent(debouncedQuery)}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <Input
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 text-lg"
        />
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        )}
        {results.length > 0 && (
          <div className="mt-4 max-h-96 space-y-1 overflow-auto">
            {results.map((task) => (
              <Link
                key={task.id}
                href={`/task/${task.id}`}
                className="hover:bg-accent flex items-center gap-3 rounded-lg p-3"
                onClick={() => onOpenChange(false)}
              >
                <Checkbox checked={task.completed} />
                <div className="min-w-0 flex-1">
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
                </div>
              </Link>
            ))}
          </div>
        )}
        {debouncedQuery.length >= 2 && !isLoading && results.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            No tasks found
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
