/**
 * FocusBuddy System
 *
 * Provides AI-powered focus session management with a gamified
 * "buddy" companion. The buddy gives real-time encouragement,
 * adjusts pomodoro timing based on task difficulty, and provides
 * post-session analysis.
 *
 * The buddy personality is configurable: supportive coach,
 * strict drill sergeant, or zen guide.
 */

import { semanticSimilarity } from '@/lib/ai/embeddings'
import type { Task } from '@/types'

export type BuddyPersonality = 'coach' | 'drill-sergeant' | 'zen' | 'cheerleader'

export type SessionPhase = 'idle' | 'preparing' | 'working' | 'short-break' | 'long-break' | 'completed'

export interface FocusSession {
  id: string
  taskId: string | null
  taskName?: string
  startTime: number
  plannedDuration: number // in minutes
  actualDuration: number | null
  phase: SessionPhase
  completed: boolean
  pausedAt: number | null
  totalPauseDuration: number
  buddyMessages: BuddyMessage[]
  // Energy level at the start (1-5)
  startingEnergy: number
}

export interface BuddyMessage {
  id: string
  text: string
  type: 'encouragement' | 'tip' | 'warning' | 'celebration' | 'question'
  timestamp: number
}

/** Personality templates for the FocusBuddy. */
const PERSONALITY_PROMPTS: Record<BuddyPersonality, string> = {
  coach: 'You are a supportive life coach. You encourage the user with positive reinforcement and practical tips. You celebrate small wins and gently push when needed.',
  'drill-sergeant': 'You are a strict military drill sergeant. You are short, direct, and push the user to their limits. You celebrate toughness and discipline.',
  zen: 'You are a calm zen master. Your messages are brief, meditative, and calming. You help the user stay present and mindful during work.',
  cheerleader: 'You are an enthusiastic cheerleader. You use emojis, exclamation points, and high energy to motivate the user. You celebrate every small win!',
}

/** Base messages for each personality, used for deterministic generation. */
const PERSONALITY_MESSAGES: Record<BuddyPersonality, Record<string, string[]>> = {
  coach: {
    encouragement: [
      "You've got this! Take it one moment at a time.",
      "I believe in you. Let's make this session count.",
      "Focus is a muscle — flex it now.",
    ],
    tip: [
      'Tip: Try the "box breathing" technique — inhale for 4, hold for 4, exhale for 4.',
      'Tip: If your mind wanders, gently bring it back to the task.',
      'Tip: Remember, progress, not perfection.',
    ],
    celebration: [
      'Session complete! Look at what you accomplished.',
      'High five! Another focused session in the books.',
      'Well done! You stuck with it through the whole session.',
    ],
    warning: [
      'I notice you might be drifting. Try refocusing on your breathing.',
      'Your energy seems low. Consider a quick stretch or hydration.',
      "Don't push through burnout — your work will suffer.",
    ],
    question: [
      'What would "future you" want to see accomplished right now?',
      'If this session had a theme, what would it be?',
    ],
  },
  'drill-sergeant': {
    encouragement: [
      "Lock and load. Time to work.",
      "Eyes on the prize. No quitting.",
      "Stay sharp. The mission is not over yet.",
    ],
    tip: [
      'Pro tip: One task at a time. Multitasking kills efficiency.',
      'Pro tip: Eliminate distractions. Phone in another room.',
      'Pro tip: Time blocks work. Respect the clock.',
    ],
    celebration: [
      'Mission accomplished. Move out!',
      'Another victory for discipline. Well done.',
      'Outstanding execution. You earned this.',
    ],
    warning: [
      'Your focus is slipping. Snap back!',
      'I see distractions creeping in. Shut them down.',
      "Don't let your guard down — push through!",
    ],
    question: [
      'What\'s your one thing for this session?',
      'Is the task worth your best effort?',
    ],
  },
  zen: {
    encouragement: [
      'Breathe in focus. Breathe out distraction.',
      'The present moment is all there is.',
      'Each breath brings you closer to completion.',
    ],
    tip: [
      'Notice your posture. Align your spine, relax your shoulders.',
      'When thoughts arise, acknowledge them, then let them pass.',
      'Your breath is your anchor. Return to it.',
    ],
    celebration: [
      'The work is done. Sit quietly and appreciate it.',
      'Completion. A moment of stillness and gratitude.',
      'The session has folded into memory. Well tended.',
    ],
    warning: [
      'The mind has wandered. Gently return.',
      'Observe the distraction without judgment, then release it.',
      'Your attention is drifting. Anchor in the present.',
    ],
    question: [
      'What does this task need from you, right now?',
      'Can you meet this moment with full presence?',
    ],
  },
  cheerleader: {
    encouragement: [
      "🎉 You're absolutely crushing it! Keep going!",
      "💪 Let's gooo! I'm in your corner the whole way!",
      "🚀 Rocket fuel activated! Blast off to productivity!",
    ],
    tip: [
      '💡 Pro tip: Keep a glass of water nearby for maximum brain power!',
      '💡 Remember: you\'re capable of amazing things. Show this task who\'s boss!',
      '💡 Dance break power! Even 30 seconds of movement boosts focus!',
    ],
    celebration: [
      '🎊 SESSION COMPLETE! You killed it! 💃🕺',
      '🎉✨ ABSOLUTELY INCREDIBLE! You’re a productivity rockstar! 🌟',
      '👏💖 You did it! So proud of you! Keep shining!',
    ],
    warning: [
      "😅 Your focus seems to be taking a coffee break. Let's snap back!",
      '🙈 Distractions are lurking! Shoo them away like pesky flies!',
      "⚡️ Energy dip detected! Quick stretch or a sip of water — go!",
    ],
    question: [
      '🎯 What would make this the BEST session ever?',
      '💫 If this task had a theme song, what would it be?',
    ],
  },
}

/**
 * Generate a message from the FocusBuddy based on the current
 * session state and personality. Uses a combination of:
 * 1. Deterministic personality-based messages
 * 2. Semantic similarity to the task for personalized messages
 */
export function generateBuddyMessage(
  session: FocusSession,
  personality: BuddyPersonality,
  task?: Task,
  elapsedMinutes?: number,
  totalMinutes?: number
): BuddyMessage {
  const messages = PERSONALITY_MESSAGES[personality]
  const phase = session.phase

  let type: BuddyMessage['type']
  let text: string = ''

  // Determine message type based on session phase and progress
  const progress =
    elapsedMinutes !== undefined && totalMinutes && totalMinutes > 0
      ? elapsedMinutes / totalMinutes
      : 0

  if (phase === 'completed') {
    type = 'celebration'
    const pool = messages.celebration
    text = pool[Math.floor(Math.random() * pool.length)]
  } else if (phase === 'preparing') {
    type = 'encouragement'
    const pool = messages.encouragement
    text =
      (task?.name
        ? `Ready to tackle "${task.name}"? ${pool[Math.floor(Math.random() * pool.length)]}`
        : pool[Math.floor(Math.random() * pool.length)])
  } else if (phase === 'working') {
    // During work, mix encouragement, tips, and occasional warnings
    const roll = Math.random()

    if (progress > 0.8 && progress < 0.95) {
      // Near the end — encouragement to push through
      type = 'encouragement'
      const pool = messages.encouragement
      text =
        (task?.name
          ? `You're almost done with "${task.name}"! ${pool[Math.floor(Math.random() * pool.length)]}`
          : pool[Math.floor(Math.random() * pool.length)])
    } else if (progress > 0.4 && progress < 0.6 && roll < 0.3) {
      // Mid-session — a tip or warning
      if (roll < 0.15) {
        type = 'warning'
        const pool = messages.warning
        text = pool[Math.floor(Math.random() * pool.length)]
      } else {
        type = 'tip'
        const pool = messages.tip
        text = pool[Math.floor(Math.random() * pool.length)]
      }
    } else {
      type = 'encouragement'
      const pool = messages.encouragement
      const chosen = pool[Math.floor(Math.random() * pool.length)]

      // If we have a task, personalize based on similarity
      if (task?.name && roll < 0.2) {
        const keywords = extractTaskKeywords(task.name)
        if (keywords.length > 0) {
          const motivationalKeyword = keywords[
            Math.floor(Math.random() * keywords.length)
          ]
          text = `${chosen} ${
            personality === 'cheerleader'
              ? `You're building momentum on ${motivationalKeyword}! 🌟`
              : `Focus on ${motivationalKeyword} — you're making progress.`
          }`
        }
      }

      if (!text) text = chosen
    }
  } else if (phase === 'short-break' || phase === 'long-break') {
    type = 'tip'
    const pool = messages.tip
    text = pool[Math.floor(Math.random() * pool.length)]
  } else {
    type = 'encouragement'
    const pool = messages.encouragement
    text = pool[Math.floor(Math.random() * pool.length)]
  }

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    type,
    timestamp: Date.now(),
  }
}

/**
 * Extract meaningful keywords from a task name using
 * hash-based similarity to identify focus themes.
 */
function extractTaskKeywords(name: string): string[] {
  const words = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)

  // Deduplicate and limit
  return Array.from(new Set(words)).slice(0, 5)
}

/**
 * Calculate the recommended session duration (in minutes)
 * based on task characteristics and user's historical data.
 *
 * Uses a simple heuristic:
 * - Tasks with "meeting", "call", "review" → 25 min (shorter, focused)
 * - Tasks with "design", "write", "plan" → 50 min (longer, creative)
 * - Default: 25 min (standard pomodoro)
 */
export function recommendSessionDuration(task?: Task): number {
  if (!task) return 25

  const text = `${task.name} ${task.description || ''}`.toLowerCase()
  const embeddings = semanticSimilarity(text, 'meeting call review discussion')

  if (embeddings > 0.4) return 25 // shorter for meetings

  const creativeSim = semanticSimilarity(text, 'design write plan architect structure')
  if (creativeSim > 0.3) return 50 // longer for creative work

  // Use estimate if available
  if (task.estimate && task.estimate > 0) {
    if (task.estimate <= 30) return 25
    if (task.estimate <= 60) return 50
    return 25 // cap at standard pomodoro
  }

  return 25
}

/**
 * Get the personality description for display.
 */
export function getPersonalityDescription(personality: BuddyPersonality): string {
  const descriptions = {
    coach: 'Supportive and encouraging, with practical tips for success.',
    'drill-sergeant': 'Strict and disciplined, pushing you to your limits.',
    zen: 'Calm and mindful, helping you stay present and centered.',
    cheerleader: 'High-energy and enthusiastic, celebrating every win!',
  }
  return descriptions[personality]
}

/**
 * Default storage key for the user's preferred personality.
 */
export const BUDDY_PERSONALITY_KEY = 'taskflow_focus_buddy_personality'

/**
 * Load the user's preferred FocusBuddy personality from localStorage.
 */
export function loadBuddyPersonality(): BuddyPersonality {
  if (typeof window === 'undefined') return 'coach'
  return (localStorage.getItem(BUDDY_PERSONALITY_KEY) as BuddyPersonality) || 'coach'
}

/**
 * Save the user's preferred FocusBuddy personality.
 */
export function saveBuddyPersonality(personality: BuddyPersonality): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(BUDDY_PERSONALITY_KEY, personality)
  }
}
