import Link from "next/link"
import { Plus, GripVertical, Check, Clock, AlertTriangle, ChevronDown, ChevronRight, Paperclip, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTasks, getTask, toggleTaskComplete, deleteTask } from "@/lib/tasks"
import type { Task } from "@/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TaskDetail } from "@/components/task-detail"
import { PriorityIcon } from "@/components/priority-icon"
import { CreateTaskForm } from "@/components/create-task-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useState } from "react"

interface TaskListProps {
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  listId?: string
  labelId?: string
  title: string
  searchQuery?: string
}

export function TaskList({ view, listId, labelId, title, searchQuery }: TaskListProps) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [selectedTask, setSelectedTask] = useState<string | null>(null)

  // This is a server component that needs data
  // For now, use server-side data fetching
  const tasks = getTasks({ view, listId, completed: undefined, search: searchQuery })
  const filteredTasks = showCompleted ? tasks : tasks.filter(t => !t.completed)

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
                <CreateTaskForm onSuccess={() => {}} defaultListId={listId} />
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={showCompleted}
                onCheckedChange={(checked) => setShowCompleted(checked === true)}
              />
              Show completed
            </label>
            <span className="text-sm text-muted-foreground">
              {filteredTasks.filter(t => !t.completed).length} remaining
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No tasks yet</p>
              <p className="text-sm mt-1">Create a task to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTasks.map(task => (
                <TaskItem key={task.id} task={task} onSelect={() => setSelectedTask(task.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <div className="w-[500px] border-l overflow-auto">
          <TaskDetail taskId={selectedTask} onClose={() => setSelectedTask(null)} />
        </div>
      )}
    </div>
  )
}

function TaskItem({ task, onSelect }: { task: Task; onSelect: () => void }) {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 }
  const subTasks = task.sub_tasks || []

  return (
    <div>
      <div className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors",
        task.completed && "opacity-60"
      )}>
        <form action={`/api/tasks/${task.id}/toggle`} method="POST">
          <button type="submit" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={task.completed === 1} />
          </button>
        </form>

        {subTasks.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Toggle sub-tasks
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            {task.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}

        <div className="flex-1 min-w-0" onClick={() => onSelect()}>
          <div className="flex items-center gap-2">
            <span className={cn("truncate", task.completed && "line-through")}>
              {task.name}
            </span>
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
            {task.date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(task.date).toLocaleDateString()}</span>}
            {task.deadline && new Date(task.deadline) < new Date() && !task.completed && (
              <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</span>
            )}
            {task.attachments && task.attachments.length > 0 && (
              <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {task.attachments.length}</span>
            )}
            {subTasks.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {subTasks.filter(s => s.completed).length}/{subTasks.length}
              </span>
            )}
          </div>
        </div>

        {task.list_id && task.list && (
          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: task.list.color + '20', color: task.list.color }}>
            {task.list.emoji} {task.list.name}
          </span>
        )}

        <form action={`/api/tasks/${task.id}/delete`} method="POST">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            ×
          </Button>
        </form>
      </div>

      {task.expanded && subTasks.length > 0 && (
        <div className="ml-8 space-y-1">
          {subTasks.map(sub => (
            <div key={sub.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50">
              <form action={`/api/tasks/${sub.id}/toggle`} method="POST">
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
