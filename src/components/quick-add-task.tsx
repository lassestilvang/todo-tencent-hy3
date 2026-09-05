'use client'

import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createTaskAction } from '@/lib/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TaskTemplateSuggestions } from '@/components/task-template-suggestions'

export function QuickAddTask({ listId }: { listId?: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, setIsPending] = useState(false)
  const [taskName, setTaskName] = useState('')

  async function handleSubmit(formData: FormData) {
    const name = formData.get('name') as string
    if (!name || name.trim() === '') return

    setIsPending(true)
    const result = await createTaskAction(formData)
    setIsPending(false)

    if (!result?.success) {
      toast.error('Failed to create task')
      return
    }

    formRef.current?.reset()
    setTaskName('')
    toast.success('Task added')
  }

  return (
    <div className="mb-4">
      <form
        ref={formRef}
        action={handleSubmit}
        className="bg-background/40 border-border/40 focus-within:border-primary/50 focus-within:ring-primary/20 mb-2 flex items-center gap-2 rounded-xl border p-2 shadow-sm transition-all focus-within:ring-1"
      >
        <div className="text-muted-foreground flex items-center justify-center pl-2">
          <Plus className="h-4 w-4" />
        </div>
        <Input
          name="name"
          placeholder="Quick add task..."
          aria-label="Quick add task"
          className="h-9 flex-1 border-0 bg-transparent px-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={isPending}
          autoComplete="off"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />
        <input type="hidden" name="listId" value={listId || ''} />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="h-8 rounded-lg"
          disabled={isPending}
        >
          Add
        </Button>
      </form>

      {/* Show template suggestions when typing a task name */}
      {taskName.trim() && (
        <TaskTemplateSuggestions
          currentTaskName={taskName}
          listId={listId}
        />
      )}
    </div>
  )
}
