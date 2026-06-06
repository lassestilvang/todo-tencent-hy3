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
import { createTaskAction } from '@/lib/actions'
import { useFormStatus } from 'react-dom'
import type { Priority } from '@/types'
import { useState, useRef } from 'react'

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
      {pending ? 'Creating...' : 'Create Task'}
    </Button>
  )
}

export function CreateTaskForm({ defaultListId }: { defaultListId?: string }) {
  const [priority, setPriority] = useState<string>('none')
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    await createTaskAction(formData)
    formRef.current?.reset()
    setPriority('none')
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <Input
        name="name"
        placeholder="Task name"
        aria-label="Task name"
        required
        autoFocus
        className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-11 rounded-xl transition-all"
      />
      <input type="hidden" name="listId" value={defaultListId || ''} />
      <Textarea
        name="description"
        placeholder="Description (optional)"
        aria-label="Task description"
        rows={3}
        className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
      />
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
          <Select defaultValue="none" onValueChange={setPriority}>
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
            placeholder="60"
            className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-10 rounded-xl transition-all"
          />
        </div>
      </div>
      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}
