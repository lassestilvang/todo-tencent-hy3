import Link from 'next/link'
import {
  Plus,
  Clock,
  AlertTriangle,
  Paperclip,
  MessageSquare,
} from 'lucide-react'
import { cn, formatDisplayDate } from '@/lib/utils'
import { getTasks } from '@/lib/tasks'
import { handleToggle, handleDelete } from '@/lib/actions'
import type { Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PriorityIcon } from '@/components/priority-icon'
import { CreateTaskForm } from '@/components/create-task-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface TaskListProps {
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  listId?: string
  title: string
  searchQuery?: string
}

export async function TaskList({
  view,
  listId,
  title,
  searchQuery,
}: TaskListProps) {
  const tasks = getTasks({
    view,
    listId,
    completed: undefined,
    search: searchQuery,
  })

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        <div className="border-b p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">{title}</h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Add a new task to your todo list
                  </DialogDescription>
                </DialogHeader>
                <CreateTaskFormWrapper />
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm">
              {tasks.filter((t) => !t.completed).length} remaining
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {tasks.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p className="text-lg">No tasks yet</p>
              <p className="mt-1 text-sm">Create a task to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskItem({ task }: { task: Task }) {
  const sorted = task.sub_tasks
    ? task.sub_tasks.toSorted((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        return (a.position || 0) - (b.position || 0)
      })
    : []

  return (
    <div>
      <div
        className={cn(
          'group hover:bg-accent/50 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
          task.completed && 'opacity-60'
        )}
        suppressHydrationWarning
      >
        <form action={handleToggle.bind(null, task.id)}>
          <button type="submit">
            <Checkbox checked={task.completed === 1} />
          </button>
        </form>
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
            {task.deadline &&
              new Date(task.deadline) < new Date() &&
              !task.completed && (
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
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {task.sub_tasks.filter((s) => s.completed).length}/
                {task.sub_tasks.length}
              </span>
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
        <form action={handleDelete.bind(null, task.id)}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete task"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            type="submit"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </form>
      </div>
      {sorted.length > 0 && (
        <div className="ml-8 space-y-1">
          {sorted.map((sub) => (
            <div
              key={sub.id}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-lg px-3 py-2"
            >
              <form action={handleToggle.bind(null, sub.id)}>
                <button type="submit">
                  <Checkbox checked={sub.completed === 1} />
                </button>
              </form>
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
    </div>
  )
}

function CreateTaskFormWrapper() {
  return <CreateTaskForm />
}
