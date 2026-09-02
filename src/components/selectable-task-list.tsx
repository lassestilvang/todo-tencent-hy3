'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'
import { Plus, Clock } from 'lucide-react'
import { getTasks } from '@/lib/tasks-client'
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
import { ToggleCompletedButton } from '@/components/toggle-completed-button'
import { BulkOperationsToolbar } from '@/components/bulk-operations-toolbar'
import { SelectableTaskCheckbox } from '@/components/selectable-task-checkbox'
import { formatTime } from '@/lib/utils'
import type { Task } from '@/types'

interface SelectableTaskListProps {
  view?: 'today' | 'next7' | 'upcoming' | 'all'
  listId?: string
  labelId?: string
  title: string
  searchQuery?: string
  showCompleted?: boolean
}

export function SelectableTaskList({
  view,
  listId,
  labelId,
  title,
  searchQuery,
  showCompleted = true,
}: SelectableTaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load tasks
  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const fetchedTasks = await getTasks({
        view,
        listId,
        labelId,
        completed: showCompleted ? undefined : false,
        search: searchQuery,
      })
      setTasks(fetchedTasks)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [view, listId, labelId, showCompleted, searchQuery])

  // Initial load
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks()
    return () => {
      mountedRef.current = false
    }
  }, [loadTasks])

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.completed).length
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  const isSelectionMode = selectedTaskIds.length > 0

  const toggleSelection = useCallback((taskId: string, selected: boolean) => {
    setSelectedTaskIds((prev) =>
      selected ? [...prev, taskId] : prev.filter((id) => id !== taskId)
    )
  }, [])

  const selectAll = useCallback(() => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([])
    } else {
      setSelectedTaskIds(tasks.map((t) => t.id))
    }
  }, [selectedTaskIds, tasks])

  const handleBulkAction = useCallback(
    async (action: string, value?: string) => {
      const { updateTask, deleteTask, toggleTaskComplete } = await import('@/lib/tasks-client')

      for (const taskId of selectedTaskIds) {
        try {
          switch (action) {
            case 'delete':
              await deleteTask(taskId)
              break
            case 'move':
              if (value) await updateTask(taskId, { list_id: value })
              break
            case 'priority':
              if (value) await updateTask(taskId, { priority: value as 'low' | 'medium' | 'high' })
              break
            case 'date':
              if (value === 'clear') {
                await updateTask(taskId, { date: null })
              } else if (value === 'today') {
                await updateTask(taskId, { date: new Date().toISOString().split('T')[0] })
              } else if (value === 'tomorrow') {
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                await updateTask(taskId, { date: tomorrow.toISOString().split('T')[0] })
              } else if (value === 'next-week') {
                const nextWeek = new Date()
                nextWeek.setDate(nextWeek.getDate() + 7)
                await updateTask(taskId, { date: nextWeek.toISOString().split('T')[0] })
              }
              break
            case 'label-add':
              if (value) {
                // This would need an API endpoint for adding labels
                console.log('Add label', value, 'to', taskId)
              }
              break
            case 'label-remove':
              if (value) {
                console.log('Remove label', value, 'from', taskId)
              }
              break
            case 'complete':
              await toggleTaskComplete(taskId)
              break
            case 'uncomplete':
              await toggleTaskComplete(taskId)
              break
          }
        } catch (error) {
          console.error(`Failed to ${action} task ${taskId}:`, error)
        }
      }

      // Refresh tasks after bulk action
      setSelectedTaskIds([])
      loadTasks()
    },
    [selectedTaskIds, loadTasks]
  )

  if (isLoading) {
    return (
      <div className="flex h-full p-4 md:p-6 lg:p-8">
        <div className="glass-effect flex flex-1 flex-col overflow-hidden rounded-2xl shadow-xl">
          <div className="bg-card/25 relative overflow-hidden border-b p-6">
            <h1 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent">
              {title}
            </h1>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full p-4 md:p-6 lg:p-8">
      <div className="glass-effect flex flex-1 flex-col overflow-hidden rounded-2xl shadow-xl">
        <div className="bg-card/25 relative overflow-hidden border-b p-6">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress}% of tasks completed`}
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
          <div className="relative z-10 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isSelectionMode && (
                <SelectableTaskCheckbox
                  taskId="select-all"
                  checked={selectedTaskIds.length === tasks.length && tasks.length > 0}
                  taskName="Select all tasks"
                  selectionMode
                  isSelected={selectedTaskIds.length === tasks.length && tasks.length > 0}
                  onSelectionChange={selectAll}
                />
              )}
              <h1 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent">
                {title}
              </h1>
            </div>
            {!isSelectionMode && (
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
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-sm font-medium">
                {tasks.filter((t) => !t.completed).length} remaining
                {totalTasks > 0 && (
                  <span className="text-muted-foreground/60">
                    {' '}
                    · {progress}% done
                  </span>
                )}
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
            {!isSelectionMode && (
              <div className="flex items-center gap-1">
                <ToggleCompletedButton />
                {tasks.some((t) => t.completed) && <ClearCompletedButton />}
              </div>
            )}
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
              <LazyMotion features={domAnimation}>
                <AnimatePresence mode="popLayout">
                  {tasks.map((task) => (
                    <AnimatedTaskItem
                      key={task.id}
                      task={task}
                      selectionMode={isSelectionMode}
                      isSelected={selectedTaskIds.includes(task.id)}
                      onSelectionChange={toggleSelection}
                    />
                  ))}
                </AnimatePresence>
              </LazyMotion>
            </div>
          )}
        </div>
      </div>

      <BulkOperationsToolbar
        selectedTaskIds={selectedTaskIds}
        onClose={() => setSelectedTaskIds([])}
        onBulkAction={handleBulkAction}
      />
    </div>
  )
}