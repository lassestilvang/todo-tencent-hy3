import {
  COMPLETION_MILESTONES,
  checkMilestone,
  getMilestoneProgress,
  getCompletedCelebrated,
  markCelebrated,
  getTotalCompleted,
  setTotalCompleted,
  countCompletedTasks,
  MILESTONE_LABELS,
} from '@/lib/completion-milestones'
import type { Task } from '@/types'

describe('COMPLETION_MILESTONES', () => {
  it('defines milestones in ascending order', () => {
    expect(COMPLETION_MILESTONES).toEqual([10, 50, 100, 1000])
  })
})

describe('MILESTONE_LABELS', () => {
  it('has labels for all milestones', () => {
    COMPLETION_MILESTONES.forEach((m) => {
      expect(MILESTONE_LABELS[m]).toBeDefined()
      expect(MILESTONE_LABELS[m].emoji).toBeDefined()
      expect(MILESTONE_LABELS[m].title).toBeDefined()
      expect(MILESTONE_LABELS[m].message).toBeDefined()
    })
  })
})

describe('countCompletedTasks', () => {
  it('counts only completed tasks', () => {
    const tasks = [
      { completed: true },
      { completed: false },
      { completed: true },
      { completed: true },
      { completed: false },
    ] as Task[]

    expect(countCompletedTasks(tasks)).toBe(3)
  })

  it('returns 0 for empty array', () => {
    expect(countCompletedTasks([])).toBe(0)
  })

  it('returns 0 when no tasks are completed', () => {
    const tasks = [{ completed: false }, { completed: false }] as Task[]
    expect(countCompletedTasks(tasks)).toBe(0)
  })
})

describe('localStorage tracking', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('getTotalCompleted returns 0 when nothing stored', () => {
    expect(getTotalCompleted()).toBe(0)
  })

  it('setTotalCompleted + getTotalCompleted round-trips', () => {
    setTotalCompleted(42)
    expect(getTotalCompleted()).toBe(42)
  })

  it('getCompletedCelebrated returns empty set initially', () => {
    expect(getCompletedCelebrated().size).toBe(0)
  })

  it('markCelebrated adds to the celebrated set', () => {
    expect(getCompletedCelebrated().has(10)).toBe(false)
    markCelebrated(10)
    expect(getCompletedCelebrated().has(10)).toBe(true)
  })
})

describe('checkMilestone', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null for count below first milestone', () => {
    expect(checkMilestone(9)).toBeNull()
    expect(checkMilestone(0)).toBeNull()
  })

  it('triggers at milestone 10', () => {
    const result = checkMilestone(10)
    expect(result).not.toBeNull()
    expect(result!.milestone).toBe(10)
    expect(result!.count).toBe(10)
    expect(result!.nextMilestone).toBe(50)
    expect(result!.remaining).toBe(40)
  })

  it('triggers at milestone 50', () => {
    markCelebrated(10)
    const result = checkMilestone(50)
    expect(result).not.toBeNull()
    expect(result!.milestone).toBe(50)
    expect(result!.nextMilestone).toBe(100)
    expect(result!.remaining).toBe(50)
  })

  it('triggers at milestone 100', () => {
    markCelebrated(10)
    markCelebrated(50)
    const result = checkMilestone(100)
    expect(result).not.toBeNull()
    expect(result!.milestone).toBe(100)
    expect(result!.nextMilestone).toBe(1000)
    expect(result!.remaining).toBe(900)
  })

  it('triggers at milestone 1000', () => {
    markCelebrated(10)
    markCelebrated(50)
    markCelebrated(100)
    const result = checkMilestone(1000)
    expect(result).not.toBeNull()
    expect(result!.milestone).toBe(1000)
    expect(result!.nextMilestone).toBeNull()
    expect(result!.remaining).toBe(0)
  })

  it('does not re-trigger an already celebrated milestone', () => {
    markCelebrated(10)
    expect(checkMilestone(10)).toBeNull()
    expect(checkMilestone(15)).toBeNull()
  })

  it('skips to the next uncelebrated milestone', () => {
    markCelebrated(10)
    markCelebrated(50)
    // Count is between 50 and 100 — no milestone crossed yet
    expect(checkMilestone(75)).toBeNull()
    // Cross 100
    const result = checkMilestone(100)
    expect(result).not.toBeNull()
    expect(result!.milestone).toBe(100)
  })

  it('handles crossing multiple milestones at once (fires first uncelebrated)', () => {
    // First time, nothing celebrated
    const result = checkMilestone(1000)
    expect(result).not.toBeNull()
    expect(result!.milestone).toBe(10) // The first uncelebrated one
  })
})

describe('getMilestoneProgress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns progress toward first milestone when nothing celebrated', () => {
    const progress = getMilestoneProgress(5)
    expect(progress.current).toBe(0)
    expect(progress.next).toBe(10)
    expect(progress.progress).toBe(0.5)
  })

  it('returns 100% progress when final milestone achieved', () => {
    COMPLETION_MILESTONES.forEach((m) => markCelebrated(m))
    const progress = getMilestoneProgress(1500)
    expect(progress.current).toBe(1000)
    expect(progress.next).toBeNull()
    expect(progress.progress).toBe(1)
  })

  it('returns progress between celebrated milestones', () => {
    markCelebrated(10)
    markCelebrated(50)
    const progress = getMilestoneProgress(75)
    expect(progress.current).toBe(50)
    expect(progress.next).toBe(100)
    expect(progress.progress).toBe(0.5) // (75-50)/(100-50) = 0.5
  })

  it('caps progress at 1 when exceeding the next milestone', () => {
    markCelebrated(10)
    const progress = getMilestoneProgress(60)
    // 60 is past 50, but 50 hasn't been celebrated yet
    // next uncelebrated is 50, current celebrated is 10
    expect(progress.current).toBe(10)
    expect(progress.next).toBe(50)
    expect(progress.progress).toBe(1) // past the next milestone
  })
})
