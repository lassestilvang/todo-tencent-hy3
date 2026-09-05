'use client'

import { useEffect } from 'react'
import { useTasks } from '@/lib/tasks-client'
import { setProgressFavicon } from '@/lib/favicon'

/**
 * Updates the browser tab favicon with a progress ring
 * reflecting today's task completion. The ring only
 * appears when there's meaningful progress (i.e. not
 * 0% and not 100%).
 */
export function useFaviconProgress() {
  const { data: tasks } = useTasks({ view: 'today' })

  useEffect(() => {
    if (!tasks) return

    const total = tasks.length
    if (total === 0) return

    const completed = tasks.filter((t: { completed: boolean }) => t.completed).length
    const progress = completed / total

    setProgressFavicon(progress).catch(() => {
      /* favicon changes are best-effort */
    })
  }, [tasks])
}
