import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { env } from '../env'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = env.TEST_DB_PATH || path.join(process.cwd(), 'tasks.db')

// Singleton database instance
let dbInstance: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (dbInstance) return dbInstance

  const sqlite = new Database(dbPath)

  // Enable WAL mode for better concurrency
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  dbInstance = drizzle(sqlite, { schema, logger: process.env.NODE_ENV === 'development' })

  return dbInstance
}

export function closeDb() {
  if (dbInstance) {
    // Drizzle doesn't expose the underlying connection directly
    // The connection will be closed when the process exits
    dbInstance = null
  }
}

// Migration runner
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

export function runMigrations() {
  const db = getDb()
  migrate(db, { migrationsFolder: './src/lib/db/migrations' })
}

// Initialize database with default data
export function initializeDatabase() {
  const db = getDb()

  // Check if lists table is empty
  const existingLists = db.select().from(schema.lists).all()
  if (existingLists.length === 0) {
    const now = new Date().toISOString()
    db.insert(schema.lists).values({
      id: 'inbox',
      name: 'Inbox',
      color: '#6366f1',
      emoji: '📥',
      createdAt: now,
      updatedAt: now,
    }).run()
  }
}

// Export schema for convenience
export * from './schema'