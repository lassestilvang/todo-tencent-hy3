'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'
import { ListChecks, X } from 'lucide-react'
import { toast } from 'sonner'
import { AnimatedTaskItem } from '@/components/animated-task-item'
import {
  BulkOperationsToolbar,
  type BulkAction,
} from '@/components/bulk-operations-toolbar'
import { Button } from '@/components/ui/button'
import { toggleTaskLabelAction } from '@/lib/actions'
import { deleteTask, updateTask } from '@/lib/tasks-client'
import { resolveBulkDate, type BulkDatePreset } from '@/lib/quick-actions'
import type { Priority, Task } from '@/types'

const BULK_TOASTS: Record<BulkAction, (count: number) => string> = {
  delete: (count) => `Deleted ${count} task${count === 1 ? '' : 's'}`,
  move: (count) => `Moved ${count} task${count === 1 ? '' : 's'}`,
  priority: (count) =>
    `Updated priority for ${count} task${count === 1 ? '' : 's'}`,
  date: (count) =>
    `Updated due date for ${count} task${count === 1 ? '' : 's'}`,
  'label-add': (count) =>
    `Added label to ${count} task${count === 1 ? '' : 's'}`,
  'label-remove': (count) =>
    `Removed label from ${count} task${count === 1 ? '' : 's'}`,
  complete: (count) => `Completed ${count} task${count === 1 ? '' : 's'}`,
  uncomplete: (count) =>
    `Reopened ${count} task${count === 1 ? '' : 's'}`,
}

/** Apply a bulk operation to every selected task. */
async function applyBulkAction(
  taskIds: string[],
  action: BulkAction,
  value?: string,
): Promise<void> {
  switch (action) {
    case 'delete':
      await Promise.all(taskIds.map((id) => deleteTask(id)))
      return
    case 'move':
      await Promise.all(
        taskIds.map((id) => updateTask(id, { list_id: value })),
      )
      return
    case 'priority':
      await Promise.all(
        taskIds.map((id) =>
          updateTask(id, { priority: value as Priority }),
        ),
      )
      return
    case 'date': {
      const date = value
        ? resolveBulkDate(value as BulkDatePreset)
        : null
      await Promise.all(taskIds.map((id) => updateTask(id, { date })))
      return
    }
    case 'label-add':
      await Promise.all(
        taskIds.map((id) => toggleTaskLabelAction(id, value ?? '', false)),
      )
      return
    case 'label-remove':
      await Promise.all(
        taskIds.map((id) => toggleTaskLabelAction(id, value ?? '', true)),
      )
      return
    case 'complete':
      await Promise.all(
        taskIds.map((id) => updateTask(id, { completed: true })),
      )
      return
    case 'uncomplete':
      await Promise.all(
        taskIds.map((id) => updateTask(id, { completed: false })),
      )
      return
  }
}

/**
 * The task list rows with bulk selection. Entering selection
 * mode turns the checkboxes into selectors; the bulk
 * operations toolbar appears once tasks are selected.
 */
export function TaskRows({ tasks }: { tasks: Task[] }) {
  const router = useRouter()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)

  const handleSelectionChange = useCallback(
    (taskId: string, selected: boolean) => {
      setSelectedIds((prev) =>
        selected
          ? prev.includes(taskId)
            ? prev
            : [...prev, taskId]
          : prev.filter((id) => id !== taskId),
      )
    },
    [],
  )

  const selectAll = () => {
    setSelectedIds(tasks.map((task) => task.id))
  }

  const clearSelection = useCallback(() => {
    setSelectedIds([])
    setSelectionMode(false)
  }, [])

  const handleBulkAction = useCallback(
    async (action: BulkAction, value?: string) => {
      if (selectedIds.length === 0) {
        return
      }

      setIsPending(true)
      try {
        await applyBulkAction(selectedIds, action, value)
        const message = BULK_TOASTS[action](selectedIds.length)
        clearSelection()
        router.refresh()
        toast.success(message)
      } catch (error) {
        console.error('Bulk action failed:', error)
        toast.error('Bulk action failed')
      } finally {
        setIsPending(false)
      }
    },
    [selectedIds, clearSelection, router],
  )

  return (
    <>
      <div className="mb-2 flex items-center justify-end gap-2">
        {selectionMode ? (
          <>
            <span className="text-muted-foreground text-sm">
              {selectedIds.length} selected
            </span>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={isPending}
            >
              <X className="mr-1 h-3 w-3" />
              Done
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectionMode(true)}
            className="text-muted-foreground/70"
          >
            <ListChecks className="mr-1 h-3 w-3" />
            Select tasks
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <LazyMotion features={domAnimation}>
          <AnimatePresence mode="popLayout">
            {tasks.map((task) => (
              <AnimatedTaskItem
                key={task.id}
                task={task}
                selectionMode={selectionMode}
                isSelected={selectedIds.includes(task.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </AnimatePresence>
        </LazyMotion>
      </div>

      <BulkOperationsToolbar
        selectedTaskIds={selectedIds}
        onClose={clearSelection}
        onBulkAction={handleBulkAction}
      />
    </>
  )
}
