'use client'

import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createTaskAction } from '@/lib/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function QuickAddSubtask({ parentId }: { parentId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    const name = formData.get('name') as string
    if (!name || name.trim() === '') return

    setIsPending(true)
    const result = await createTaskAction(formData)
    setIsPending(false)

    if (!result?.success) {
      toast.error('Failed to create subtask')
      return
    }

    formRef.current?.reset()
    toast.success('Subtask added')
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="bg-background/40 border-border/40 focus-within:border-primary/50 focus-within:ring-primary/20 mt-2 flex items-center gap-2 rounded-xl border p-2 shadow-sm transition-all focus-within:ring-1"
    >
      <div className="text-muted-foreground flex items-center justify-center pl-2">
        <Plus className="h-3 w-3" />
      </div>
      <Input
        name="name"
        placeholder="Add subtask..."
        aria-label="Add subtask"
        className="h-7 flex-1 border-0 bg-transparent px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
        disabled={isPending}
        autoComplete="off"
      />
      <input type="hidden" name="parentId" value={parentId} />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        className="h-6 rounded-lg px-2 text-xs"
        disabled={isPending}
      >
        Add
      </Button>
    </form>
  )
}
