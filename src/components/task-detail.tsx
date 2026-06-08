'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  X,
  Paperclip,
  Trash2,
  Clock,
  ListTodo,
  FileText,
  Pencil,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PriorityIcon } from '@/components/priority-icon'
import { handleDeleteAndRedirect } from '@/lib/actions'
import { TaskCheckbox } from '@/components/task-checkbox'
import { cn, formatDisplayDate, formatDateTime } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EditTaskForm } from '@/components/edit-task-form'
import type { Task } from '@/types'
import { toast } from 'sonner'

export function TaskDetail({ task }: { task: Task }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/task/${task.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied to clipboard')
  }

  return (
    <div className="glass-effect bg-card/15 space-y-6 overflow-hidden rounded-2xl border p-6 shadow-xl md:p-8">
      <div className="border-border/40 flex items-start justify-between border-b pb-4">
        <div className="flex flex-1 items-center gap-3">
          <TaskCheckbox
            taskId={task.id}
            checked={task.completed}
            taskName={task.name}
          />
          <h2
            className={cn(
              'from-foreground to-foreground/80 flex-1 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent',
              task.completed && 'line-through opacity-60'
            )}
          >
            {task.name}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-accent/40 rounded-full"
            onClick={handleCopyLink}
            title="Copy Link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent/40 rounded-full"
                title="Edit Task"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
                <DialogDescription>Update task details</DialogDescription>
              </DialogHeader>
              <EditTaskForm
                task={task}
                onCancel={() => setIsEditDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-accent/40 rounded-full"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-6 text-sm">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2">
          <PriorityIcon priority={task.priority} />
          <span className="text-foreground/85 font-medium capitalize">
            {task.priority} Priority
          </span>
          {task.date && (
            <>
              <span className="text-border/60">•</span>
              <Clock className="text-muted-foreground/80 h-3.5 w-3.5" />
              <span className="text-foreground/85">
                {formatDisplayDate(task.date)}
              </span>
            </>
          )}
          {task.list && (
            <>
              <span className="text-border/60">•</span>
              <ListTodo className="text-muted-foreground/80 h-3.5 w-3.5" />
              <span className="text-foreground/85">
                {task.list.emoji} {task.list.name}
              </span>
            </>
          )}
        </div>

        {task.description && (
          <div className="text-muted-foreground bg-accent/25 border-border/10 flex gap-3 rounded-xl border p-4">
            <FileText className="text-muted-foreground/75 mt-0.5 h-4 w-4" />
            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        <div className="bg-accent/15 border-border/10 grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
              Date
            </span>
            <p className="text-foreground font-medium">
              {formatDisplayDate(task.date)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
              Deadline
            </span>
            <p
              className={cn(
                'font-medium',
                task.deadline &&
                  new Date(task.deadline) < new Date() &&
                  !task.completed
                  ? 'text-destructive'
                  : 'text-foreground'
              )}
            >
              {formatDisplayDate(task.deadline) || '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
              Priority
            </span>
            <p className="text-foreground font-medium capitalize">
              {task.priority}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
              Estimate
            </span>
            <p className="text-foreground font-medium">
              {task.estimate ? `${task.estimate} min` : '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
              Last updated
            </span>
            <p className="text-foreground font-medium">
              {formatDateTime(task.updated_at)}
            </p>
          </div>
        </div>

        {task.labels && task.labels.length > 0 && (
          <div>
            <span className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
              Labels
            </span>
            <div className="flex flex-wrap gap-1.5">
              {task.labels.map((l) => (
                <Badge
                  key={l.id}
                  variant="secondary"
                  className="hover:bg-secondary/80 border-border/10 border"
                >
                  {l.icon} {l.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {task.sub_tasks && task.sub_tasks.length > 0 && (
          <div>
            <span className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
              Subtasks
            </span>
            <div className="bg-accent/10 border-border/5 space-y-2 rounded-xl border p-3">
              {task.sub_tasks.map((sub) => (
                <div
                  key={sub.id}
                  className="hover:bg-accent/20 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <TaskCheckbox
                    taskId={sub.id}
                    checked={sub.completed}
                    taskName={sub.name}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      sub.completed
                        ? 'line-through opacity-60'
                        : 'text-foreground/90'
                    )}
                  >
                    {sub.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.attachments && task.attachments.length > 0 && (
          <div>
            <span className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
              Attachments
            </span>
            <div className="space-y-1.5">
              {task.attachments.map((att) => (
                <div
                  key={att.id}
                  className="hover:bg-accent/40 border-border/10 flex items-center gap-2 rounded-xl border p-2.5 text-sm transition-all duration-200"
                >
                  <Paperclip className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-foreground/80 flex-1 font-medium">
                    {att.file_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.logs && task.logs.length > 0 && (
          <div>
            <span className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
              Activity Log
            </span>
            <div className="bg-accent/5 border-border/5 max-h-36 space-y-1.5 overflow-auto rounded-xl border p-3">
              {task.logs.map((log) => (
                <div
                  key={log.id}
                  className="text-muted-foreground/80 border-border/5 border-b p-1 pb-1.5 text-xs last:border-0"
                >
                  <span className="text-foreground/60 font-semibold">
                    {formatDateTime(log.created_at)}
                  </span>{' '}
                  — {log.details || log.action}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-border/40 flex justify-end border-t pt-4">
          <form
            action={handleDeleteAndRedirect.bind(null, task.id)}
            onSubmit={(e) => {
              if (
                !window.confirm('Are you sure you want to delete this task?')
              ) {
                e.preventDefault()
              }
            }}
          >
            <Button
              variant="destructive"
              size="sm"
              type="submit"
              className="hover:shadow-destructive/25 shadow-lg transition-all"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete Task
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
