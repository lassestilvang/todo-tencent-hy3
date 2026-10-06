'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  countCompletedTasks,
  checkMilestone,
  markCelebrated,
  getMilestoneProgress,
  getTotalCompleted,
  setTotalCompleted,
  MILESTONE_LABELS,
  COMPLETION_MILESTONES,
  type MilestoneAchievement,
  type Milestone,
} from '@/lib/completion-milestones'
import type { Task } from '@/types'

interface CompletionMilestoneCelebrationProps {
  tasks: Task[]
}

const CONFETTI_COUNT = 60

/** Individual confetti piece — deterministic per index for stable renders. */
function ConfettiPiece({
  index,
  delay,
}: {
  index: number
  delay: number
}) {
  const hue = (index * 37) % 360
  const size = 6 + (index % 6)
  const left = (index * 13) % 100
  const duration = 2 + (index % 3)
  const color = `hsl(${hue}, 80%, 55%)`

  return (
    <div
      className="pointer-events-none absolute rounded-sm"
      style={{
        left: `${left}%`,
        top: '-10px',
        width: `${size}px`,
        height: `${size * 1.5}px`,
        backgroundColor: color,
        animation: `confetti-fall ${duration}s ease-in-out ${delay}ms forwards`,
        transform: `rotate(${(index * 17) % 360}deg)`,
      }}
    />
  )
}

export function CompletionMilestoneCelebration({
  tasks,
}: CompletionMilestoneCelebrationProps) {
  const [achievement, setAchievement] = useState<MilestoneAchievement | null>(
    null,
  )
  const [showConfetti, setShowConfetti] = useState(false)
  const [prevCompleted, setPrevCompleted] = useState(0)

  // Count completed tasks on the current page
  const completedCount = countCompletedTasks(tasks)

  useEffect(() => {
    if (completedCount > prevCompleted && completedCount > 0) {
      // A task was just completed — increment the cumulative counter
      const total = getTotalCompleted() + (completedCount - prevCompleted)
      setTotalCompleted(total)

      const achieved = checkMilestone(total)
      if (achieved) {
        setAchievement(achieved)
        setShowConfetti(true)
        markCelebrated(achieved.milestone)

        // Show a toast notification
        const label = MILESTONE_LABELS[achieved.milestone]
        toast.success(
          <div className="flex items-center gap-2">
            <span className="text-2xl">{label.emoji}</span>
            <div>
              <strong className="block">{label.title}</strong>
              <span className="text-sm">{label.message}</span>
            </div>
          </div>,
          { duration: 5000 },
        )

        // Clean up after animation
        setTimeout(() => {
          setShowConfetti(false)
          setAchievement(null)
        }, 3000)
      }
    }
    setPrevCompleted(completedCount)
  }, [completedCount, prevCompleted])

  if (!showConfetti || !achievement) return null

  const label = MILESTONE_LABELS[achievement.milestone]

  return (
    <>
      {/* Confetti canvas covering the full screen */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
          <ConfettiPiece key={i} index={i} delay={(i * 37) % 1000} />
        ))}
      </div>

      {/* Centered celebration banner */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
        <div className="animate-bounce">
          <div className="rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-8 py-6 text-center shadow-2xl">
            <div className="text-6xl mb-2">{label.emoji}</div>
            <h2 className="text-2xl font-bold text-white">{label.title}</h2>
            <p className="text-sm text-white/90 mt-1">{label.message}</p>
            <div className="mt-3 flex justify-center gap-1">
              {COMPLETION_MILESTONES.map((m: Milestone) => (
                <span
                  key={m}
                  className={`h-1.5 w-1.5 rounded-full transition-all ${
                    m === achievement.milestone
                      ? 'bg-white w-6'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * A small progress indicator showing how close the user is to the
 * next uncelebrated milestone. Place this near the task list header.
 */
export function MilestoneProgress({ tasks }: { tasks: Task[] }) {
  const completedCount = countCompletedTasks(tasks)
  const storedTotal = getTotalCompleted()
  // Use the max of the stored cumulative count and this page's completed count
  const effectiveTotal = Math.max(storedTotal, completedCount)
  const progress = getMilestoneProgress(effectiveTotal)

  if (progress.next === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-yellow-500">🏆</span>
        <span>All milestones achieved!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">
        {effectiveTotal}/{progress.next} to next milestone
      </span>
      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500"
          style={{ width: `${progress.progress * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground/60">
        {MILESTONE_LABELS[progress.next]?.emoji}
      </span>
    </div>
  )
}
