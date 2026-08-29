'use client'

import { TaskList } from '@/components/task-list'
import { SmartSuggestions } from '@/components/smart-suggestions'
import { Suspense } from 'react'
import type { Task, List } from '@/types'

interface TodayClientProps {
  tasks: Task[]
  lists: List[]
  showCompleted?: boolean
}

export function TodayClient({ tasks, lists, showCompleted = true }: TodayClientProps) {
  return (
    <div className="flex h-full p-4 md:p-6 lg:p-8">
      <div className="glass-effect flex flex-1 flex-col overflow-hidden rounded-2xl shadow-xl">
        <Suspense fallback={
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        }>
          <SmartSuggestions tasks={tasks} lists={lists} view="today" />
        </Suspense>
        <TaskList
          view="today"
          title="Today"
          showCompleted={showCompleted}
        />
      </div>
    </div>
  )
}