'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateTaskAction } from '@/lib/actions'
import { useFormStatus } from 'react-dom'
import type { Priority, Task } from '@/types'
import { useState } from 'react'
import { cn, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="hover:shadow-primary/25 w-full font-semibold shadow-lg transition-all duration-200"
      disabled={pending}
    >
      {pending ? 'Saving...' : 'Save Changes'}
    </Button>
  )
}

export function EditTaskForm({
  task,
  onCancel,
}: {
  task: Task
  onCancel: () => void
}) {
  const [priority, setPriority] = useState<string>(task.priority || 'none')
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await updateTaskAction(task.id, formData)
    if (!result.success) {
      setErrors(result.errors || null)
      toast.error('Failed to update task. Please check your inputs.')
      return
    }
    toast.success('Task updated successfully')
    onCancel()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Input
          name="name"
          defaultValue={task.name}
          placeholder="Task name"
          aria-label="Task name"
          required
          autoFocus
          className={cn(
            'bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-11 rounded-xl transition-all',
            errors?.name && 'border-destructive focus:border-destructive'
          )}
        />
        {errors?.name && (
          <p className="text-destructive text-xs">{errors.name[0]}</p>
        )}
      </div>
      <input type="hidden" name="listId" value={task.list_id || ''} />
      <div className="space-y-1.5">
        <Textarea
          name="description"
          defaultValue={task.description || ''}
          placeholder="Description (optional)"
          aria-label="Task description"
          rows={3}
          className={cn(
            'bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all',
            errors?.description && 'border-destructive focus:border-destructive'
          )}
        />
        {errors?.description && (
          <p className="text-destructive text-xs">{errors.description[0]}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor="date"
            className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase"
          >
            Date
          </label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={formatDate(task.date)}
            className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-10 rounded-xl transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="deadline"
            className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase"
          >
            Deadline
          </label>
          <Input
            id="deadline"
            name="deadline"
            type="date"
            defaultValue={formatDate(task.deadline)}
            className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-10 rounded-xl transition-all"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor="priority"
            className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase"
          >
            Priority
          </label>
          <input type="hidden" name="priority" value={priority} />
          <Select defaultValue={task.priority} onValueChange={setPriority}>
            <SelectTrigger
              id="priority"
              className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-10 rounded-xl transition-all"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-effect bg-card/90 rounded-xl border">
              {PRIORITIES.map((p) => (
                <SelectItem
                  key={p.value}
                  value={p.value}
                  className="hover:bg-accent/40 rounded-lg"
                >
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="estimate"
            className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase"
          >
            Estimate (min)
          </label>
          <Input
            id="estimate"
            name="estimate"
            type="number"
            min="1"
            max="9999"
            defaultValue={task.estimate || ''}
            placeholder="60"
            className={cn(
              'bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-10 rounded-xl transition-all',
              errors?.estimate && 'border-destructive focus:border-destructive'
            )}
          />
          {errors?.estimate && (
            <p className="text-destructive text-xs">{errors.estimate[0]}</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="w-full"
        >
          Cancel
        </Button>
        <SubmitButton />
      </div>
    </form>
  )
}
