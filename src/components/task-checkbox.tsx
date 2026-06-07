'use client'

import { useRef } from 'react'
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
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={handleToggle.bind(null, taskId)}>
      <Checkbox
        checked={checked}
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={
          checked
            ? `Mark task "${taskName}" as incomplete`
            : `Mark task "${taskName}" as complete`
        }
      />
    </form>
  )
}
