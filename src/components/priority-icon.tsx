"use client"

import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react"
import type { Priority } from "@/types"

export function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 'none') return null

  const config = {
    high: { icon: AlertTriangle, color: 'text-red-500', label: 'High Priority' },
    medium: { icon: ArrowUp, color: 'text-yellow-500', label: 'Medium Priority' },
    low: { icon: ArrowDown, color: 'text-blue-500', label: 'Low Priority' },
  }

  const { icon: Icon, color, label } = config[priority]
  return <Icon className={`w-3.5 h-3.5 ${color}`} />
}
