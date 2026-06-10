'use client'

import { m } from 'framer-motion'
import Link from 'next/link'
import {
  Clock,
  AlertTriangle,
  Paperclip,
  MessageSquare,
  Pencil,
} from 'lucide-react'
import { cn, formatDisplayDate, isOverdue } from '@/lib/utils'
import { handleDelete } from '@/lib/actions'
import type { Task } from '@/types'
import { Button } from '@/components/ui/button'
import { PriorityIcon } from '@/components/priority-icon'
import { TaskCheckbox } from '@/components/task-checkbox'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EditTaskForm } from '@/components/edit-task-form'

export function AnimatedTaskItem({ task }: { task: Task }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const sorted = task.sub_tasks
    ? [...task.sub_tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        return (a.position || 0) - (b.position || 0)
      })
    : []

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={cn(
          'group hover:bg-accent/40 hover:border-border/20 flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 transition-all duration-200 hover:translate-x-1 hover:shadow-sm',
          task.completed && 'opacity-60'
        )}
        suppressHydrationWarning
      >
        <TaskCheckbox
          taskId={task.id}
          checked={task.completed}
          taskName={task.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/task/${task.id}`}
              className={cn('truncate', task.completed && 'line-through')}
            >
              {task.name}
            </Link>
            <PriorityIcon priority={task.priority} />
            {task.labels && task.labels.length > 0 && (
              <div className="flex gap-1">
                {task.labels.map((l) => (
                  <span
                    key={l.id}
                    className="rounded px-1.5 py-0.5 text-xs"
                    style={{ backgroundColor: l.color + '20', color: l.color }}
                  >
                    {l.icon} {l.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
            {task.date && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatDisplayDate(task.date)}
              </span>
            )}
            {isOverdue(task.date, task.deadline, task.completed) && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </span>
            )}
            {task.attachments && task.attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> {task.attachments.length}
              </span>
            )}
            {task.sub_tasks && task.sub_tasks.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {task.sub_tasks.filter((s) => s.completed).length}/
                  {task.sub_tasks.length}
                </span>
                <div className="bg-muted hidden h-1 w-10 overflow-hidden rounded-full sm:block">
                  <div
                    className="bg-primary h-full transition-all duration-500 ease-out"
                    style={{
                      width: `${(task.sub_tasks.filter((s) => s.completed).length / task.sub_tasks.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {task.list_id && task.list && (
          <span
            className="rounded px-2 py-1 text-xs"
            style={{
              backgroundColor: task.list.color + '20',
              color: task.list.color,
            }}
          >
            {task.list.emoji} {task.list.name}
          </span>
        )}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit task"
                className="h-7 w-7"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
              </DialogHeader>
              <EditTaskForm
                task={task}
                onCancel={() => setIsEditDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <form action={handleDelete.bind(null, task.id)}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete task"
              className="h-7 w-7"
              type="submit"
            >
              <span aria-hidden="true">×</span>
            </Button>
          </form>
        </div>
      </div>
      {sorted.length > 0 && (
        <div className="ml-8 space-y-1">
          {sorted.map((sub) => (
            <div
              key={sub.id}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-lg px-3 py-2"
            >
              <TaskCheckbox
                taskId={sub.id}
                checked={sub.completed}
                taskName={sub.name}
              />
              <span
                className={cn(
                  'text-sm',
                  sub.completed && 'line-through opacity-60'
                )}
              >
                {sub.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </m.div>
  )
}
