'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

export function ToggleCompletedButton() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const showCompleted = searchParams.get('completed') !== 'false'

  const toggle = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (showCompleted) {
      params.set('completed', 'false')
    } else {
      params.delete('completed')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="hover:bg-accent/40 text-xs transition-colors"
      title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
    >
      {showCompleted ? (
        <EyeOff className="mr-2 h-3.5 w-3.5" />
      ) : (
        <Eye className="mr-2 h-3.5 w-3.5" />
      )}
      {showCompleted ? 'Hide completed' : 'Show completed'}
    </Button>
  )
}
