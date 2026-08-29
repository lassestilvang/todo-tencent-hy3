import 'server-only'

import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import {
  lists,
  labels,
  tasks,
  taskLabels,
  taskAttachments,
  taskReminders,
  taskLogs,
  taskDependencies,
} from './schema'
import { env } from '../env'
import path from 'path'
import { fileURLToPath } from 'url'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import fs from 'fs'

// Get __dirname in a way that works with both ESM and Jest
const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url))
  } catch {
    // Fallback for Jest/test environments
    return path.dirname(process.cwd() + '/src/lib/db/index.ts')
  }
}

const __dirname = getDirname()

const dbPath = env.TEST_DB_PATH || path.join(process.cwd(), 'tasks.db')

// Ensure database directory exists
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

// Schema object with only table definitions - explicitly typed to prevent inference issues
const dbSchema = {
  lists,
  labels,
  tasks,
  taskLabels,
  taskAttachments,
  taskReminders,
  taskLogs,
  taskDependencies,
} as const satisfies Record<string, SQLiteTableWithColumns<any>>

// Singleton database instance
type DbSchema = typeof dbSchema
let dbInstance: BetterSQLite3Database<DbSchema> | null = null

export function getDb(): BetterSQLite3Database<DbSchema> {
  if (dbInstance) return dbInstance

  try {
    const sqlite = new Database(dbPath)

    // Enable WAL mode for better concurrency
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')

    dbInstance = drizzle(sqlite, { schema: dbSchema, logger: process.env.NODE_ENV === 'development' })

    return dbInstance
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
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
  const existingLists = db.select().from(lists).all()
  if (existingLists.length === 0) {
    const now = new Date().toISOString()
    db.insert(lists).values({
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