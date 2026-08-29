'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { handleToggle } from '@/lib/actions'
import { startTransition, useOptimistic } from 'react'

interface SelectableTaskCheckboxProps {
  taskId: string
  checked: boolean
  taskName: string
  /** If true, checkbox is for bulk selection instead of completion toggle */
  selectionMode?: boolean
  /** When in selectionMode, this is the selection state */
  isSelected?: boolean
  /** When in selectionMode, this is called on selection change */
  onSelectionChange?: (taskId: string, selected: boolean) => void
}

export function SelectableTaskCheckbox({
  taskId,
  checked,
  taskName,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}: SelectableTaskCheckboxProps) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(
    checked,
    (_, newChecked: boolean) => newChecked
  )

  const handleChange = (c: boolean) => {
    if (selectionMode && onSelectionChange) {
      onSelectionChange(taskId, c)
    } else {
      startTransition(() => {
        setOptimisticChecked(c === true)
        handleToggle(taskId)
      })
    }
  }

  const displayChecked = selectionMode ? isSelected : optimisticChecked
  const ariaLabel = selectionMode
    ? `Select task "${taskName}" for bulk actions`
    : displayChecked
      ? `Mark task "${taskName}" as incomplete`
      : `Mark task "${taskName}" as complete`

  return (
    <Checkbox
      checked={displayChecked}
      onCheckedChange={handleChange}
      aria-label={ariaLabel}
      disabled={selectionMode ? false : undefined}
    />
  )
}