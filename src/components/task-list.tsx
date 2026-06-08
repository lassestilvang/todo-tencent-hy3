import { AnimatePresence } from 'framer-motion'
import { Plus, Clock } from 'lucide-react'
import { getTasks } from '@/lib/tasks'
import { Button } from '@/components/ui/button'
import { CreateTaskForm } from '@/components/create-task-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AnimatedTaskItem } from '@/components/animated-task-item'
import { ClearCompletedButton } from '@/components/clear-completed-button'
import { QuickAddTask } from '@/components/quick-add-task'

import { formatTime } from '@/lib/utils'

interface TaskListProps {
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  listId?: string
  labelId?: string
  title: string
  searchQuery?: string
}

export async function TaskList({
  view,
  listId,
  labelId,
  title,
  searchQuery,
}: TaskListProps) {
  const tasks = getTasks({
    view,
    listId,
    labelId,
    completed: undefined,
    search: searchQuery,
  })

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.completed).length
  const progress =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  return (
    <div className="flex h-full p-4 md:p-6 lg:p-8">
      <div className="glass-effect flex flex-1 flex-col overflow-hidden rounded-2xl shadow-xl">
        <div className="bg-card/25 relative overflow-hidden border-b p-6">
          <div
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
          <div className="relative z-10 mb-4 flex items-center justify-between">
            <h1 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent">
              {title}
            </h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="hover:shadow-primary/20 shadow-lg transition-all duration-200"
                >
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
                <CreateTaskForm />
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-sm font-medium">
                {tasks.filter((t) => !t.completed).length} remaining
              </span>
              {(() => {
                const totalMinutes = tasks
                  .filter((t) => !t.completed)
                  .reduce((acc, t) => acc + (t.estimate || 0), 0)
                return totalMinutes > 0 ? (
                  <span className="text-muted-foreground/70 text-xs">
                    ~{formatTime(totalMinutes)} estimated
                  </span>
                ) : null
              })()}
            </div>
            {tasks.some((t) => t.completed) && <ClearCompletedButton />}
          </div>
        </div>

        <div className="bg-card/10 flex-1 overflow-auto p-6">
          <QuickAddTask listId={listId} />
          {tasks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
                <Clock className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-foreground text-2xl font-bold">All clear!</h2>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                You&apos;ve got no tasks for {title.toLowerCase()}. Take a break
                or add a new task to get ahead!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {tasks.map((task) => (
                  <AnimatedTaskItem key={task.id} task={task} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
