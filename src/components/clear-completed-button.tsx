'use client'

import { handleClearCompleted } from '@/lib/actions'
import { Button } from '@/components/ui/button'

export function ClearCompletedButton() {
  const handleSubmit = (e: React.FormEvent) => {
    if (
      !window.confirm('Are you sure you want to delete all completed tasks?')
    ) {
      e.preventDefault()
    }
  }

  return (
    <form action={handleClearCompleted} onSubmit={handleSubmit}>
      <Button
        variant="ghost"
        size="sm"
        type="submit"
        className="hover:bg-destructive/10 hover:text-destructive text-xs transition-colors"
      >
        Clear completed
      </Button>
    </form>
  )
}
