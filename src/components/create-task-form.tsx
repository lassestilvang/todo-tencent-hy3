'use client'

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createTaskAction } from "@/lib/actions"
import type { Priority } from "@/types"

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export function CreateTaskForm({ defaultListId }: { defaultListId?: string }) {
  return (
    <form action={createTaskAction} className="space-y-4">
      <Input
        name="name"
        placeholder="Task name"
        autoFocus
        required
      />
      <input type="hidden" name="listId" value={defaultListId || ''} />
      <Textarea
        name="description"
        placeholder="Description (optional)"
        rows={3}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input name="date" type="date" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Priority</label>
          <Select name="priority" defaultValue="none">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full">Create Task</Button>
    </form>
  )
}
