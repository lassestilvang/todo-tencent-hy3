import {
  isFocusModeActive,
  setFocusModeActive,
  enterFocusMode,
  exitFocusMode,
} from '@/lib/focus-mode-store'

const STORAGE_KEY = 'taskflow-focus-mode-active'

describe('Focus Mode Store', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  describe('isFocusModeActive / setFocusModeActive', () => {
    it('returns false by default', () => {
      expect(isFocusModeActive()).toBe(false)
    })

    it('returns true after setFocusModeActive(true)', () => {
      setFocusModeActive(true)
      expect(isFocusModeActive()).toBe(true)
    })

    it('returns false after setFocusModeActive(false)', () => {
      setFocusModeActive(true)
      setFocusModeActive(false)
      expect(isFocusModeActive()).toBe(false)
    })

    it('persists state in sessionStorage', () => {
      setFocusModeActive(true)
      expect(sessionStorage.getItem(STORAGE_KEY)).toBe('true')

      setFocusModeActive(false)
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('reads persisted state on startup', () => {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      expect(isFocusModeActive()).toBe(true)

      sessionStorage.setItem(STORAGE_KEY, 'false')
      expect(isFocusModeActive()).toBe(false)

      sessionStorage.removeItem(STORAGE_KEY)
      expect(isFocusModeActive()).toBe(false)
    })
  })

  describe('enterFocusMode / exitFocusMode', () => {
    it('enterFocusMode sets active to true', () => {
      enterFocusMode()
      expect(isFocusModeActive()).toBe(true)
    })

    it('exitFocusMode sets active to false', () => {
      enterFocusMode()
      exitFocusMode()
      expect(isFocusModeActive()).toBe(false)
    })

    it('emits a focus-mode-change event on enter', () => {
      const handler = jest.fn()
      window.addEventListener('taskflow:focus-mode-change', handler)

      enterFocusMode()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          detail: { active: true },
        })
      )

      window.removeEventListener('taskflow:focus-mode-change', handler)
    })

    it('emits a focus-mode-change event on exit', () => {
      const handler = jest.fn()
      window.addEventListener('taskflow:focus-mode-change', handler)

      exitFocusMode()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          detail: { active: false },
        })
      )

      window.removeEventListener('taskflow:focus-mode-change', handler)
    })
  })

  describe('event subscription', () => {
    it('multiple listeners all receive change events', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      window.addEventListener('taskflow:focus-mode-change', handler1)
      window.addEventListener('taskflow:focus-mode-change', handler2)

      setFocusModeActive(true)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)

      window.removeEventListener('taskflow:focus-mode-change', handler1)
      window.removeEventListener('taskflow:focus-mode-change', handler2)
    })
  })
})
