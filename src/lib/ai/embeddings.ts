/**
 * Semantic Embeddings System
 * Generates and compares text embeddings for semantic similarity
 */

/**
 * Embedding vector
 */
export interface Embedding {
  vector: number[]
  dimension: number
  created: number
}

/**
 * Simple hash-based embedding generator
 * In a production system, this would use a real ML model
 */
class HashEmbedder {
  private dimension: number

  constructor(dimension = 64) {
    this.dimension = dimension
  }

  /**
   * Generate embedding from text
   */
  generate(text: string): number[] {
    const normalized = this.normalize(text)
    const vector = new Array(this.dimension).fill(0)

    // Create a hash-based embedding
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i)
      const index = (charCode * 31 + i) % this.dimension
      vector[index] += 1
    }

    // Normalize to unit length
    const length = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    if (length > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= length
      }
    }

    return vector
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match')
    }

    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
    const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))

    if (normA === 0 || normB === 0) return 0
    return dotProduct / (normA * normB)
  }

  /**
   * Calculate similarity between two texts
   */
  textSimilarity(text1: string, text2: string): number {
    return this.cosineSimilarity(this.generate(text1), this.generate(text2))
  }

  /**
   * Find most similar texts
   */
  findSimilar(query: string, texts: string[], topK = 5): { text: string; similarity: number }[] {
    const queryVec = this.generate(query)
    const results = texts.map(text => ({
      text,
      similarity: this.cosineSimilarity(queryVec, this.generate(text)),
    }))

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
}

// Singleton instance
const embedder = new HashEmbedder(64)

/**
 * Generate embedding vector for text
 * Returns just the vector for use in similarity calculations
 */
export function generateEmbeddings(text: string): number[] {
  return embedder.generate(text)
}

/**
 * Calculate semantic similarity between two texts
 */
export function semanticSimilarity(text1: string, text2: string): number {
  return embedder.textSimilarity(text1, text2)
}

/**
 * Find most similar texts from a list
 */
export function findSimilarTexts(query: string, texts: string[], topK = 5): { text: string; similarity: number }[] {
  return embedder.findSimilar(query, texts, topK)
}

/**
 * Find similar tasks based on name and description
 * Returns array of task IDs sorted by similarity
 */
export function findSimilarTasks(
  tasks: { name: string; description?: string; id: string }[],
  queryTask?: { name: string; description?: string },
  topK = 5
): string[] {
  if (tasks.length === 0) return []

  // If no query task provided, use the first task as the query
  const query = queryTask || tasks[0]
  const queryText = `${query.name} ${query.description || ''}`
  const queryVec = embedder.generate(queryText)

  const results = tasks
    .map(task => {
      const taskText = `${task.name} ${task.description || ''}`
      const taskVec = embedder.generate(taskText)
      return {
        id: task.id,
        similarity: embedder.cosineSimilarity(queryVec, taskVec),
      }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(r => r.id)

  return results
}

/**
 * Cluster similar tasks together
 */
export function clusterTasks(
  tasks: { name: string; description?: string; id: string }[],
  threshold = 0.7
): Map<string, string[]> {
  // Group task IDs by cluster
  const clusters = new Map<string, string[]>()
  const assigned = new Set<string>()

  for (const task of tasks) {
    if (assigned.has(task.id)) continue

    // Find similar tasks
    const similar = tasks.filter(other => {
      if (assigned.has(other.id) || other.id === task.id) return false
      const sim = embedder.textSimilarity(
        `${task.name} ${task.description || ''}`,
        `${other.name} ${other.description || ''}`
      )
      return sim >= threshold
    })

    // Create cluster
    const clusterKey = task.id
    clusters.set(clusterKey, [task.id, ...similar.map(t => t.id)])
    assigned.add(task.id)
    similar.forEach(t => assigned.add(t.id))
  }

  return clusters
}