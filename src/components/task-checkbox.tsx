'use client'

import { useOptimistic, startTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { handleToggle } from '@/lib/actions'

export function TaskCheckbox({
  taskId,
  checked,
  taskName,
}: {
  taskId: string
  checked: boolean
  taskName: string
}) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(
    checked,
    (_, newChecked: boolean) => newChecked
  )

  return (
    <Checkbox
      checked={optimisticChecked}
      onCheckedChange={(c) => {
        startTransition(() => {
          setOptimisticChecked(c === true)
          handleToggle(taskId)
        })
      }}
      aria-label={
        optimisticChecked
          ? `Mark task "${taskName}" as incomplete`
          : `Mark task "${taskName}" as complete`
      }
    />
  )
}
