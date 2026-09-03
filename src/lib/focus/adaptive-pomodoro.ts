/**
 * Adaptive Pomodoro
 *
 * Adjusts the focus-session duration based on how often sessions
 * run to completion instead of being abandoned. Pure and free of
 * side effects so the behaviour is unit-testable.
 */

/** Focus durations the settings UI offers, ordered shortest to longest. */
export const POMODORO_DURATION_STEPS = [15, 20, 25, 30, 40, 50, 60] as const

export interface AdaptiveFocusStats {
  /** Pomodoros that ran to completion */
  sessionsCompleted: number
  /** Pomodoros started but reset before finishing */
  sessionsAbandoned: number
  /** Current focus duration in minutes */
  pomodoroDuration: number
}

export interface AdaptationResult {
  /** New focus duration in minutes (unchanged when stable) */
  pomodoroDuration: number
  /** True when the duration moved */
  changed: boolean
  reason: 'improving' | 'struggling' | 'stable' | 'insufficient-data'
}

/** Sessions needed before the duration is allowed to move. */
export const MIN_SESSIONS_FOR_ADJUSTMENT = 4

/** Completion rate at or above which the duration is lengthened. */
export const HIGH_COMPLETION_RATE = 0.8

/** Completion rate at or below which the duration is shortened. */
export const LOW_COMPLETION_RATE = 0.4

export function adaptPomodoroDuration(
  stats: AdaptiveFocusStats
): AdaptationResult {
  const total = stats.sessionsCompleted + stats.sessionsAbandoned
  if (total < MIN_SESSIONS_FOR_ADJUSTMENT) {
    return {
      pomodoroDuration: stats.pomodoroDuration,
      changed: false,
      reason: 'insufficient-data',
    }
  }

  const completionRate = stats.sessionsCompleted / total

  // Anchor to the offered duration closest to the current one. A
  // hand-edited value that isn't offered falls back to the default.
  const knownIndex = POMODORO_DURATION_STEPS.indexOf(
    stats.pomodoroDuration as (typeof POMODORO_DURATION_STEPS)[number]
  )
  const index =
    knownIndex === -1 ? POMODORO_DURATION_STEPS.indexOf(25) : knownIndex

  // Finishing nearly every session means the duration is
  // sustainable, so stretch it one step.
  if (
    completionRate >= HIGH_COMPLETION_RATE &&
    index < POMODORO_DURATION_STEPS.length - 1
  ) {
    return {
      pomodoroDuration: POMODORO_DURATION_STEPS[index + 1],
      changed: true,
      reason: 'improving',
    }
  }

  // Frequently abandoning sessions means the duration is too long
  // to sustain, so shrink it one step.
  if (completionRate <= LOW_COMPLETION_RATE && index > 0) {
    return {
      pomodoroDuration: POMODORO_DURATION_STEPS[index - 1],
      changed: true,
      reason: 'struggling',
    }
  }

  return {
    pomodoroDuration: stats.pomodoroDuration,
    changed: false,
    reason: 'stable',
  }
}
