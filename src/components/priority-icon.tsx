import { AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react'
import type { Priority } from '@/types'

export function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 'none') return null

  const config = {
    high: { icon: AlertTriangle, color: 'text-red-500' },
    medium: { icon: ArrowUp, color: 'text-yellow-500' },
    low: { icon: ArrowDown, color: 'text-blue-500' },
  }

  const { icon: Icon, color } = config[priority]
  return <Icon className={`h-3.5 w-3.5 ${color}`} />
}
