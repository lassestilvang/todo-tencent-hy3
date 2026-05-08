import Link from 'next/link'
import { X, Paperclip, Trash2, Clock, ListTodo, FileText } from 'lucide-react'
import { getTask } from '@/lib/tasks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PriorityIcon } from '@/components/priority-icon'
import { handleDelete } from '@/lib/actions'
import { TaskCheckbox } from '@/components/task-checkbox'
import { cn, formatDisplayDate, formatDateTime } from '@/lib/utils'

export function TaskDetail({ taskId }: { taskId: string }) {
  const task = getTask(taskId)

  if (!task)
    return <div className="text-muted-foreground p-6">Task not found</div>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-1 items-center gap-3">
          <TaskCheckbox taskId={taskId} checked={task.completed} />
          <h2
            className={cn(
              'flex-1 text-lg font-semibold',
              task.completed && 'line-through opacity-60'
            )}
          >
            {task.name}
          </h2>
        </div>
        <Link href="/">
          <Button variant="ghost" size="icon">
            <X className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-4 text-sm">
        <div className="text-muted-foreground flex items-center gap-2">
          <PriorityIcon priority={task.priority} />
          <span className="capitalize">{task.priority}</span>
          {task.date && (
            <>
              <Clock className="h-3 w-3" />
              <span>{formatDisplayDate(task.date)}</span>
            </>
          )}
          {task.list && (
            <>
              <ListTodo className="h-3 w-3" />
              <span>
                {task.list.emoji} {task.list.name}
              </span>
            </>
          )}
        </div>

        {task.description && (
          <div className="text-muted-foreground flex gap-2">
            <FileText className="mt-0.5 h-4 w-4" />
            <p className="whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-muted-foreground text-xs">Date</span>
            <p>{formatDisplayDate(task.date)}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Deadline</span>
            <p>{formatDisplayDate(task.deadline) || '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Priority</span>
            <p className="capitalize">{task.priority}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Estimate</span>
            <p>{task.estimate ? `${task.estimate} min` : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Last updated</span>
            <p>{formatDateTime(task.updated_at)}</p>
          </div>
        </div>

        {task.labels && task.labels.length > 0 && (
          <div>
            <span className="text-muted-foreground text-xs">Labels</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {task.labels.map((l) => (
                <Badge key={l.id} variant="secondary">
                  {l.icon} {l.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {task.sub_tasks && task.sub_tasks.length > 0 && (
          <div>
            <span className="text-muted-foreground text-xs">Subtasks</span>
            <div className="mt-1 space-y-1">
              {task.sub_tasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <TaskCheckbox taskId={sub.id} checked={sub.completed} />
                  <span
                    className={sub.completed ? 'line-through opacity-60' : ''}
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
            <span className="text-muted-foreground text-xs">Attachments</span>
            <div className="mt-1 space-y-1">
              {task.attachments.map((att) => (
                <div
                  key={att.id}
                  className="hover:bg-accent flex items-center gap-2 rounded p-2 text-sm"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="flex-1">{att.file_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.logs && task.logs.length > 0 && (
          <div>
            <span className="text-muted-foreground text-xs">Activity Log</span>
            <div className="mt-1 max-h-32 space-y-1 overflow-auto">
              {task.logs.map((log) => (
                <div key={log.id} className="text-muted-foreground p-1 text-xs">
                  {formatDateTime(log.created_at)} - {log.details || log.action}
                </div>
              ))}
            </div>
          </div>
        )}

        <form action={handleDelete.bind(null, taskId)}>
          <Button variant="destructive" size="sm" type="submit">
            <Trash2 className="mr-2 h-3 w-3" />
            Delete Task
          </Button>
        </form>
      </div>
    </div>
  )
}
