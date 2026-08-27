"use client"

import { formatTime, generateId } from '@/lib/utils'

describe('Utility functions', () => {
  describe('formatTime', () => {
    it('converts minutes to hours and minutes format', () => {
      expect(formatTime(60)).toBe('1h')
      expect(formatTime(120)).toBe('2h')
      expect(formatTime(90)).toBe('1h 30m')
      expect(formatTime(150)).toBe('2h 30m')
      expect(formatTime(45)).toBe('45m')
      expect(formatTime(0)).toBe('0m')
    })
  })

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
      expect(typeof id1).toBe('string')
    })
  })
})