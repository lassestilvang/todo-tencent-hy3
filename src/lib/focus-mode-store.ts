/**
 * Focus Mode Store
 *
 * Minimal client-side store for tracking whether a focus session is
 * active. Any component can subscribe to changes; the DND bubble and
 * notification guard use it to suppress non-essential interruptions
 * during deep-work sessions.
 *
 * Uses a simple event-target pattern (no external state library needed)
 * and persists the active state in sessionStorage so it survives
 * hard navigations within the same tab.
 */

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'taskflow-focus-mode-active'
const EVENT_NAME = 'taskflow:focus-mode-change'

let active = false

function readFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeToStorage(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* fail silently */
  }
}

function emitChange(value: boolean): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { active: value } })
  )
}

/** Check if focus mode is currently active. */
export function isFocusModeActive(): boolean {
  if (typeof window === 'undefined') {
    return active
  }
  return readFromStorage()
}

/** Enter or exit focus mode. */
export function setFocusModeActive(value: boolean): void {
  active = value
  writeToStorage(value)
  emitChange(value)
}

/** Enter focus mode. */
export function enterFocusMode(): void {
  setFocusModeActive(true)
}

/** Exit focus mode. */
export function exitFocusMode(): void {
  setFocusModeActive(false)
}

/** React-style hook for subscribing to focus mode changes. */
export function useFocusMode(): boolean {
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const update = () => setIsFocused(isFocusModeActive())
    update() // initial read

    window.addEventListener(EVENT_NAME, update)
    return () => window.removeEventListener(EVENT_NAME, update)
  }, [])

  return isFocused
}
