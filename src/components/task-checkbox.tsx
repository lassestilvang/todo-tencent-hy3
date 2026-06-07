'use client'

import { useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { handleToggle } from '@/lib/actions'

export function TaskCheckbox({
  taskId,
  checked,
}: {
  taskId: string
  checked: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={handleToggle.bind(null, taskId)}>
      <Checkbox
        checked={checked}
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={
          checked ? 'Mark task as incomplete' : 'Mark task as complete'
        }
      />
    </form>
  )
}
