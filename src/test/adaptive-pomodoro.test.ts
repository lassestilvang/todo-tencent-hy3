import {
  adaptPomodoroDuration,
  POMODORO_DURATION_STEPS,
  MIN_SESSIONS_FOR_ADJUSTMENT,
} from '@/lib/focus/adaptive-pomodoro'

describe('Adaptive Pomodoro', () => {
  it('should not adjust before enough sessions', () => {
    const result = adaptPomodoroDuration({
      sessionsCompleted: 3,
      sessionsAbandoned: 0,
      pomodoroDuration: 25,
    })

    expect(result.changed).toBe(false)
    expect(result.reason).toBe('insufficient-data')
    expect(result.pomodoroDuration).toBe(25)
  })

  it('should lengthen the duration when completion is high', () => {
    const result = adaptPomodoroDuration({
      sessionsCompleted: 4,
      sessionsAbandoned: 0,
      pomodoroDuration: 25,
    })

    expect(result.changed).toBe(true)
    expect(result.reason).toBe('improving')
    expect(result.pomodoroDuration).toBe(30)
  })

  it('should shorten the duration when completion is low', () => {
    const result = adaptPomodoroDuration({
      sessionsCompleted: 1,
      sessionsAbandoned: 4,
      pomodoroDuration: 25,
    })

    expect(result.changed).toBe(true)
    expect(result.reason).toBe('struggling')
    expect(result.pomodoroDuration).toBe(20)
  })

  it('should stay stable in the middle band', () => {
    const result = adaptPomodoroDuration({
      sessionsCompleted: 3,
      sessionsAbandoned: 3,
      pomodoroDuration: 25,
    })

    expect(result.changed).toBe(false)
    expect(result.reason).toBe('stable')
    expect(result.pomodoroDuration).toBe(25)
  })

  it('should treat the boundary rates as adjustable', () => {
    const improving = adaptPomodoroDuration({
      sessionsCompleted: 4,
      sessionsAbandoned: 1, // exactly 0.8
      pomodoroDuration: 25,
    })
    expect(improving.reason).toBe('improving')

    const struggling = adaptPomodoroDuration({
      sessionsCompleted: 2,
      sessionsAbandoned: 3, // exactly 0.4
      pomodoroDuration: 25,
    })
    expect(struggling.reason).toBe('struggling')
  })

  it('should not lengthen past the longest offered duration', () => {
    const result = adaptPomodoroDuration({
      sessionsCompleted: 10,
      sessionsAbandoned: 0,
      pomodoroDuration: 60,
    })

    expect(result.changed).toBe(false)
    expect(result.reason).toBe('stable')
    expect(result.pomodoroDuration).toBe(60)
  })

  it('should not shorten past the shortest offered duration', () => {
    const result = adaptPomodoroDuration({
      sessionsCompleted: 1,
      sessionsAbandoned: 10,
      pomodoroDuration: 15,
    })

    expect(result.changed).toBe(false)
    expect(result.reason).toBe('stable')
    expect(result.pomodoroDuration).toBe(15)
  })

  it('should anchor an unknown duration to the default before moving', () => {
    const result = adaptPomodoroDuration({
      sessionsCompleted: 4,
      sessionsAbandoned: 0,
      pomodoroDuration: 27, // not an offered duration
    })

    // 27 anchors to 25, then improves to the next step.
    expect(result.changed).toBe(true)
    expect(result.pomodoroDuration).toBe(30)
  })

  it('should keep every offered duration as a valid adaptation target', () => {
    // Walking the ladder upward must stay within the
    // durations the settings UI offers.
    let duration = 25
    let up = adaptPomodoroDuration({
      sessionsCompleted: 8,
      sessionsAbandoned: 0,
      pomodoroDuration: duration,
    })
    while (up.changed) {
      duration = up.pomodoroDuration
      expect(POMODORO_DURATION_STEPS).toContain(duration)
      up = adaptPomodoroDuration({
        sessionsCompleted: 8,
        sessionsAbandoned: 0,
        pomodoroDuration: duration,
      })
    }
    expect(duration).toBe(60)
  })

  it('should use a completion threshold that requires real data', () => {
    // Sanity-check the tuning constants so the feature only
    // reacts once there is a meaningful sample.
    expect(MIN_SESSIONS_FOR_ADJUSTMENT).toBeGreaterThanOrEqual(4)
    expect(POMODORO_DURATION_STEPS).toEqual([...POMODORO_DURATION_STEPS].sort((a, b) => a - b))
  })
})
