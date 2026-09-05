/**
 * Shared in-memory stores for habits and their executions.
 * Used by the habits API routes to avoid duplicating state
 * between the habits and executions endpoints.
 */

import type { Habit, HabitExecution } from '@/lib/habits'

export const habitStore = new Map<string, Habit>()
export const executionStore = new Map<string, HabitExecution[]>()
