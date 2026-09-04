/**
 * AI-powered filtering
 *
 * Ranks tasks by semantic similarity to a query
 * using the hash-based embedding model, blended
 * with a bonus for exact substring matches so a
 * literal keyword still outranks a vague
 * paraphrase. Heuristic, deterministic and
 * dependency-free — the embedding model lives in
 * `lib/ai/embeddings.ts`.
 */

import { matchesFilter, type TaskFilter } from '../filter-presets'
import { semanticSimilarity } from './embeddings'
import type { Task } from '@/types'

export interface SemanticMatch {
  task: Task
  /** Relevance in the 0–1 range. */
  score: number
  /** True when the query appears verbatim. */
  exactMatch: boolean
}

export interface SemanticFilterOptions {
  /** Minimum score to include. Default 0.35. */
  threshold?: number
  /** Maximum number of results. Default 20. */
  limit?: number
  /** Added to the score of substring matches. Default 0.3. */
  substringBonus?: number
  /** Only rank tasks that match this filter. */
  filter?: TaskFilter
}

// Calibrated against the hash embedder: related
// strings score 0.28–0.59, unrelated strings
// 0.14–0.21, so 0.25 separates them.
const DEFAULT_THRESHOLD = 0.25
const DEFAULT_LIMIT = 20
const DEFAULT_SUBSTRING_BONUS = 0.3

/**
 * Rank tasks by relevance to a natural-language
 * query. Exact substring matches always pass the
 * threshold; everything else needs a similarity
 * above `threshold`.
 */
export function rankTasksByQuery(
  tasks: Task[],
  query: string,
  options: SemanticFilterOptions = {},
): SemanticMatch[] {
  const {
    threshold = DEFAULT_THRESHOLD,
    limit = DEFAULT_LIMIT,
    substringBonus = DEFAULT_SUBSTRING_BONUS,
    filter,
  } = options

  const needle = query.trim().toLowerCase()
  if (!needle) {
    return []
  }

  const candidates = filter
    ? tasks.filter((task) => matchesFilter(task, filter))
    : tasks

  const matches = candidates
    .map((task) => {
      const haystack = `${task.name} ${task.description ?? ''}`
        .toLowerCase()
        .trim()
      const exactMatch = haystack.includes(needle)
      const similarity = semanticSimilarity(query, haystack)
      const score = Math.min(
        1,
        similarity + (exactMatch ? substringBonus : 0),
      )
      return { task, score, exactMatch }
    })
    .filter((match) => match.exactMatch || match.score >= threshold)
    .sort((a, b) => b.score - a.score)

  return matches.slice(0, limit)
}

/** Same as `rankTasksByQuery`, but only the tasks. */
export function semanticFilterTasks(
  tasks: Task[],
  query: string,
  options: SemanticFilterOptions = {},
): Task[] {
  return rankTasksByQuery(tasks, query, options).map(
    (match) => match.task,
  )
}
