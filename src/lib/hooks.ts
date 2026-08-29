'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for handling keyboard shortcuts
 * Usage: useKeyPress(['Meta', 'k'], () => { ... })
 * Supports: 'Meta', 'Control', 'Shift', 'Alt', and any key
 */
export function useKeyPress(
  keys: string[],
  callback: (event: KeyboardEvent) => void,
  options?: { preventDefault?: boolean; stopPropagation?: boolean }
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const pressedKeys = new Set<string>()

      if (event.metaKey) pressedKeys.add('Meta')
      if (event.ctrlKey) pressedKeys.add('Control')
      if (event.shiftKey) pressedKeys.add('Shift')
      if (event.altKey) pressedKeys.add('Alt')
      if (event.key !== 'Meta' && event.key !== 'Control' && event.key !== 'Shift' && event.key !== 'Alt') {
        pressedKeys.add(event.key)
      }

      const allKeysPressed = keys.every((key) => pressedKeys.has(key))

      if (allKeysPressed) {
        if (options?.preventDefault) event.preventDefault()
        if (options?.stopPropagation) event.stopPropagation()
        callback(event)
      }
    },
    [keys, callback, options?.preventDefault, options?.stopPropagation]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Hook for detecting if a specific key is currently pressed
 */
export function useKeyDown(key: string): boolean {
  const [isPressed, setIsPressed] = useState(false)

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.key === key) setIsPressed(true)
    }
    const handleUp = (e: KeyboardEvent) => {
      if (e.key === key) setIsPressed(false)
    }

    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)

    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
    }
  }, [key])

  return isPressed
}