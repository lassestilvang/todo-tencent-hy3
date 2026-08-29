'use client'

import { useState, useEffect } from 'react'
import {
  Link,
  Link2,
  X,
  AlertCircle,
  Copy,
  Plus,
  Search,
  Minus,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTaskDependencies, addTaskDependency, removeTaskDependency, canCompleteTask } from '@/lib/tasks-client'
import { getTasks } from '@/lib/tasks-client'
import type { Task } from '@/types'
import { toast } from 'sonner'

interface TaskDependenciesProps {
  taskId: string
}

export function TaskDependencies({ taskId }: TaskDependenciesProps) {
  const [blocking, setBlocking] = useState<Task[]>([])
  const [blocked, setBlocked] = useState<Task[]>([])
  const [canComplete, setCanComplete] = useState(true)
  const [blockingTasks, setBlockingTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [selectedType, setSelectedType] = useState<'blocks' | 'relates' | 'duplicates'>('blocks')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])

  const loadDependencies = async () => {
    try {
      setIsLoading(true)
      const [deps, canCompleteResult] = await Promise.all([
        getTaskDependencies(taskId),
        canCompleteTask(taskId),
      ])
      setBlocking(deps.blocking)
      setBlocked(deps.blocked)
      setCanComplete(canCompleteResult.canComplete)
      setBlockingTasks(canCompleteResult.blockingTasks)
    } catch (error) {
      console.error('Failed to load dependencies:', error)
      toast.error('Failed to load dependencies')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailableTasks = async () => {
    try {
      const tasks = await getTasks({ view: 'all', completed: false })
      // Filter out current task and already linked tasks
      const linkedIds = new Set([...blocking.map(t => t.id), ...blocked.map(t => t.id), taskId])
      setAvailableTasks(tasks.filter(t => !linkedIds.has(t.id)))
    } catch (error) {
      console.error('Failed to load available tasks:', error)
    }
  }

  useEffect(() => {
    loadDependencies()
  }, [taskId])

  useEffect(() => {
    if (isAddDialogOpen) {
      loadAvailableTasks()
    }
  }, [isAddDialogOpen])

  const handleAddDependency = async () => {
    if (!selectedTaskId) return
    try {
      await addTaskDependency(selectedTaskId, taskId, selectedType)
      toast.success('Dependency added')
      setIsAddDialogOpen(false)
      setSelectedTaskId('')
      loadDependencies()
    } catch (error) {
      console.error('Failed to add dependency:', error)
      toast.error('Failed to add dependency')
    }
  }

  const handleRemoveDependency = async (otherTaskId: string, isBlocking: boolean) => {
    try {
      if (isBlocking) {
        await removeTaskDependency(otherTaskId, taskId)
      } else {
        await removeTaskDependency(taskId, otherTaskId)
      }
      toast.success('Dependency removed')
      loadDependencies()
    } catch (error) {
      console.error('Failed to remove dependency:', error)
      toast.error('Failed to remove dependency')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Blocking tasks (tasks that must be completed first) */}
      {blocking.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Blocking ({blocking.length})
            {!canComplete && <span className="text-xs text-destructive">Cannot complete</span>}
          </h4>
          <div className="space-y-1 ml-4">
            {blocking.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-2 bg-destructive/5 rounded-lg border border-destructive/10"
              >
                <Link2 className="h-4 w-4 text-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Type: blocks · {task.date ? `Due: ${task.date}` : 'No due date'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveDependency(task.id, true)}
                  className="h-7 w-7"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked tasks (tasks that depend on this one) */}
      {blocked.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Link className="h-4 w-4" />
            Blocked by this task ({blocked.length})
          </h4>
          <div className="space-y-1 ml-4">
            {blocked.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10"
              >
                <Link className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Type: {selectedType} · {task.date ? `Due: ${task.date}` : 'No due date'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveDependency(task.id, false)}
                  className="h-7 w-7"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {blocking.length === 0 && blocked.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Link2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No dependencies yet</p>
          <p className="text-xs mt-1">Link tasks that block or are blocked by this task</p>
        </div>
      )}

      {/* Add dependency button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setIsAddDialogOpen(true)
        }}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Dependency
      </Button>

      {/* Add Dependency Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Dependency</DialogTitle>
            <DialogDescription>
              Select a task that blocks or is blocked by the current task
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Dependency Type</label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as 'blocks' | 'relates' | 'duplicates')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocks">Blocks (must complete first)</SelectItem>
                  <SelectItem value="relates">Relates to</SelectItem>
                  <SelectItem value="duplicates">Duplicates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Select Task</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {availableTasks
                .filter((t) =>
                  t.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((task) => (
                  <Button
                    key={task.id}
                    variant="outline"
                    className={`w-full justify-start gap-3 ${
                      selectedTaskId === task.id
                        ? 'bg-primary/10 border-primary text-primary'
                        : ''
                    }`}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="flex-1 text-left">
                      <p className="font-medium truncate">{task.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.date ? `Due: ${task.date}` : 'No due date'} ·
                        {task.list?.name || 'No list'}
                      </p>
                    </div>
                    {selectedTaskId === task.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                ))}
              {availableTasks.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No available tasks to link
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddDependency}
                disabled={!selectedTaskId}
              >
                Add Dependency
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}