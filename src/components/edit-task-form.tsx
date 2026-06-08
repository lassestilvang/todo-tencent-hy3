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
import {
  updateTaskAction,
  getListsAction,
  getLabelsAction,
  toggleTaskLabelAction,
} from '@/lib/actions'
import { useFormStatus } from 'react-dom'
import type { Priority, Task, List, Label } from '@/types'
import { useState, useEffect, useOptimistic, startTransition } from 'react'
import { cn, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Check } from 'lucide-react'

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
  const [listId, setListId] = useState<string>(task.list_id || 'none')
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null)
  const [lists, setLists] = useState<List[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [optimisticLabels, setOptimisticLabels] = useOptimistic(
    task.labels || [],
    (state: Label[], action: { type: 'toggle'; label: Label }) => {
      const hasLabel = state.some((l) => l.id === action.label.id)
      if (hasLabel) {
        return state.filter((l) => l.id !== action.label.id)
      } else {
        return [...state, action.label]
      }
    }
  )

  useEffect(() => {
    getListsAction().then(setLists)
    getLabelsAction().then(setLabels)
  }, [])

  async function handleSubmit(formData: FormData) {
    if (listId !== 'none') {
      formData.set('listId', listId)
    } else {
      formData.delete('listId') // Send empty listId if 'none' is selected
    }
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
            htmlFor="list"
            className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase"
          >
            List
          </label>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger
              id="list"
              className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-10 rounded-xl transition-all"
            >
              <SelectValue placeholder="Select a list" />
            </SelectTrigger>
            <SelectContent className="glass-effect bg-card/90 rounded-xl border">
              <SelectItem
                value="none"
                className="hover:bg-accent/40 rounded-lg"
              >
                No List
              </SelectItem>
              {lists.map((list) => (
                <SelectItem
                  key={list.id}
                  value={list.id}
                  className="hover:bg-accent/40 rounded-lg"
                >
                  {list.emoji} {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase">
          Labels
        </label>
        <div className="flex flex-wrap gap-2">
          {labels.length === 0 ? (
            <span className="text-muted-foreground text-xs italic">
              No labels available
            </span>
          ) : (
            labels.map((label) => {
              const isSelected = optimisticLabels.some((l) => l.id === label.id)
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      setOptimisticLabels({ type: 'toggle', label })
                      toggleTaskLabelAction(task.id, label.id, isSelected)
                    })
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                    isSelected
                      ? 'bg-accent/60'
                      : 'hover:bg-accent/30 bg-transparent'
                  )}
                  style={{
                    borderColor: label.color + '40',
                    color: label.color,
                  }}
                >
                  <span>{label.icon}</span>
                  <span>{label.name}</span>
                  {isSelected && <Check className="ml-1 h-3 w-3" />}
                </button>
              )
            })
          )}
        </div>
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
