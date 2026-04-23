import Link from "next/link"
import { X, Paperclip, Trash2, Clock, Calendar, Tag, ListTodo, FileText } from "lucide-react"
import { getTask, toggleTaskComplete, deleteTask, addTaskLabel, removeTaskLabel, getLabels, addTaskAttachment, removeTaskAttachment } from "@/lib/tasks"
import type { Task, Label } from "@/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { PriorityIcon } from "@/components/priority-icon"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Input } from "@/components/ui/input"

export async function TaskDetail({ taskId, onUpdate }: { taskId: string; onUpdate: () => void }) {
  const task = getTask(taskId)
  const labels = getLabels()

  if (!task) return <div className="p-6 text-muted-foreground">Task not found</div>

  async function handleToggle() {
    'use server'
    toggleTaskComplete(taskId)
    revalidatePath('/')
  }

  async function handleDelete() {
    'use server'
    deleteTask(taskId)
    redirect('/today')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <form action={handleToggle}>
            <button type="submit">
              <Checkbox checked={task.completed === 1} />
            </button>
          </form>
          <h2 className={`text-lg font-semibold flex-1 ${task.completed ? 'line-through opacity-60' : ''}`}>
            {task.name}
          </h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onUpdate}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <PriorityIcon priority={task.priority} />
          <span className="capitalize">{task.priority}</span>
          {task.date && <><Clock className="w-3 h-3" /> {new Date(task.date).toLocaleDateString()}</>}
          {task.list && <><ListTodo className="w-3 h-3" /> {task.list.emoji} {task.list.name}</>}
        </div>

        {task.description && (
          <div className="flex gap-2 text-muted-foreground">
            <FileText className="w-4 h-4 mt-0.5" />
            <p className="whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Date</label>
            <p>{task.date ? new Date(task.date).toLocaleDateString() : 'Not set'}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <p className="capitalize">{task.priority}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Labels</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {task.labels?.map(l => (
              <Badge key={l.id} variant="secondary">
                {l.icon} {l.name}
              </Badge>
            ))}
          </div>
        </div>

        {task.sub_tasks && task.sub_tasks.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Subtasks</span>
            <div className="mt-1 space-y-1">
              {task.sub_tasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2">
                  <Checkbox checked={sub.completed === 1} />
                  <span className={sub.completed ? 'line-through opacity-60' : ''}>
                    {sub.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.attachments && task.attachments.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Attachments</span>
            <div className="mt-1 space-y-1">
              {task.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 text-sm p-2 hover:bg-accent rounded">
                  <Paperclip className="w-3 h-3" />
                  <span className="flex-1">{att.file_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.logs && task.logs.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Activity Log</span>
            <div className="mt-1 space-y-1 max-h-32 overflow-auto">
              {task.logs.map(log => (
                <div key={log.id} className="text-xs text-muted-foreground p-1">
                  {new Date(log.created_at).toLocaleString()} - {log.action}
                </div>
              ))}
            </div>
          </div>
        )}

        <form action={handleDelete}>
          <Button variant="destructive" size="sm" type="submit">
            <Trash2 className="w-3 h-3 mr-2" />
            Delete Task
          </Button>
        </form>
      </div>
    </div>
  )
}

function cn(...args: any[]) {
  return args.filter(Boolean).join(' ')
}
