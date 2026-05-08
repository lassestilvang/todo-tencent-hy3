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
import { useState } from 'react'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating...' : 'Create Task'}
    </Button>
  )
}

export function CreateTaskForm({ defaultListId }: { defaultListId?: string }) {
  const [priority, setPriority] = useState<string>('none')
  return (
    <form action={createTaskAction} className="space-y-4">
      <Input
        name="name"
        placeholder="Task name"
        aria-label="Task name"
        required
      />
      <input type="hidden" name="listId" value={defaultListId || ''} />
      <Textarea
        name="description"
        placeholder="Description (optional)"
        aria-label="Task description"
        rows={3}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="date" className="text-muted-foreground text-xs">
            Date
          </label>
          <Input id="date" name="date" type="date" />
        </div>
        <div className="space-y-1">
          <label htmlFor="deadline" className="text-muted-foreground text-xs">
            Deadline
          </label>
          <Input id="deadline" name="deadline" type="date" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="priority" className="text-muted-foreground text-xs">
            Priority
          </label>
          <input type="hidden" name="priority" value={priority} />
          <Select defaultValue="none" onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="estimate" className="text-muted-foreground text-xs">
            Estimate (min)
          </label>
          <Input
            id="estimate"
            name="estimate"
            type="number"
            min="1"
            max="9999"
            placeholder="60"
          />
        </div>
      </div>
      <SubmitButton />
    </form>
  )
}
