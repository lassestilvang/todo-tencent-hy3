import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '@/lib/db/schema'

// In-memory test database
const sqlite = new Database(':memory:')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const testDb = drizzle(sqlite, { schema })

export function getDb() {
  return testDb
}

export function runMigrations() {
  // No-op for tests
}

export function initializeDatabase() {
  const now = new Date().toISOString()
  testDb.insert(schema.lists).values({
    id: 'inbox',
    name: 'Inbox',
    color: '#6366f1',
    emoji: '📥',
    createdAt: now,
    updatedAt: now,
  }).run()
}

export function closeDb() {
  // No-op
}

export * from '@/lib/db/schema'