'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Task } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { cn, formatDisplayDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      return
    }
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`
        )
        const data = await response.json()
        setResults(data)
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <Input
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.length < 2) {
              setResults([])
            }
          }}
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
                <Checkbox checked={task.completed === 1} />
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
        {query.length >= 2 && results.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            No tasks found
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
