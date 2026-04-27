import Link from "next/link"
import { Plus, Clock, AlertTriangle, Paperclip, MessageSquare } from "lucide-react"
import { cn, formatDisplayDate } from "@/lib/utils"
import { getTasks } from "@/lib/tasks"
import { handleToggle, handleDelete } from "@/lib/actions"
import type { Task } from "@/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PriorityIcon } from "@/components/priority-icon"
import { CreateTaskForm } from "@/components/create-task-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface TaskListProps {
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  listId?: string
  title: string
  searchQuery?: string;
}

export async function TaskList({ view, listId, title, searchQuery }: TaskListProps) {
  const tasks = getTasks({ view, listId, completed: undefined, search: searchQuery })

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{title}</h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <CreateTaskFormWrapper />
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {tasks.filter(t => !t.completed).length} remaining
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No tasks yet</p>
              <p className="text-sm mt-1">Create a task to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tasks.map(task => (
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
  const sorted = task.sub_tasks ? [...task.sub_tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return (a.position || 0) - (b.position || 0)
  }) : []

  return (
    <div>
      <div className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors",
        task.completed && "opacity-60"
      )}>
        <form action={handleToggle.bind(null, task.id)}>
          <button type="submit">
            <Checkbox checked={task.completed === 1} />
          </button>
        </form>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/task/${task.id}`} className={cn("truncate", task.completed && "line-through")}>
              {task.name}
            </Link>
            <PriorityIcon priority={task.priority} />
            {task.labels && task.labels.length > 0 && (
              <div className="flex gap-1">
                {task.labels.map(l => (
                  <span key={l.id} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: l.color + '20', color: l.color }}>
                    {l.icon} {l.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {task.date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDisplayDate(task.date)}</span>}
            {task.deadline && new Date(task.deadline) < new Date() && !task.completed && (
              <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</span>
            )}
            {task.attachments && task.attachments.length > 0 && (
              <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {task.attachments.length}</span>
            )}
            {task.sub_tasks && task.sub_tasks.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {task.sub_tasks.filter(s => s.completed).length}/{task.sub_tasks.length}
              </span>
            )}
          </div>
        </div>
        {task.list_id && task.list && (
          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: task.list.color + '20', color: task.list.color }}>
            {task.list.emoji} {task.list.name}
          </span>
        )}
        <form action={handleDelete.bind(null, task.id)}>
          <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity" type="submit">
            ×
          </Button>
        </form>
      </div>
      {sorted.length > 0 && (
        <div className="ml-8 space-y-1">
          {sorted.map(sub => (
            <div key={sub.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50">
              <form action={handleToggle.bind(null, sub.id)}>
                <button type="submit">
                  <Checkbox checked={sub.completed === 1} />
                </button>
              </form>
              <span className={cn("text-sm", sub.completed && "line-through opacity-60")}>
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
