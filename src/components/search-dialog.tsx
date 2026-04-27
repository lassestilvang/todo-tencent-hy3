"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Task } from "@/types"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Task[]>([])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setResults(data)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <Input
          placeholder="Search tasks..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          className="text-lg h-12"
        />
        {results.length > 0 && (
          <div className="max-h-96 overflow-auto space-y-1 mt-4">
            {results.map(task => (
              <Link
                key={task.id}
                href={`/task/${task.id}`}
                className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg"
                onClick={() => onOpenChange(false)}
              >
                <Checkbox checked={task.completed === 1} />
                <div className="flex-1 min-w-0">
                  <p className={cn("truncate", task.completed && "line-through opacity-60")}>
                    {task.name}
                  </p>
                  {task.date && (
                    <p className="text-xs text-muted-foreground">{new Date(task.date).toLocaleDateString()}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No tasks found</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function cn(...args: any[]) {
  return args.filter(Boolean).join(' ')
}
