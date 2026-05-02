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
  return (
    <form action={createTaskAction} className="space-y-4">
      <Input
        name="name"
        placeholder="Task name"
        aria-label="Task name"
        autoFocus
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
          <label className="text-muted-foreground text-xs">Date</label>
          <Input name="date" type="date" />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">Priority</label>
          <Select name="priority" defaultValue="none">
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
      </div>
      <SubmitButton />
    </form>
  )
}
