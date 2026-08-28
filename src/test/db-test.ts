import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '@/lib/db/schema'

// In-memory test database
const sqlite = new Database(':memory:')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const testDb = drizzle(sqlite, { schema })

export function runTestMigrations() {
  migrate(testDb, { migrationsFolder: './src/lib/db/migrations' })
}

export function initializeTestDatabase() {
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

export function clearTestDatabase() {
  testDb.delete(schema.taskDependencies).run()
  testDb.delete(schema.taskLogs).run()
  testDb.delete(schema.taskReminders).run()
  testDb.delete(schema.taskAttachments).run()
  testDb.delete(schema.taskLabels).run()
  testDb.delete(schema.tasks).run()
  testDb.delete(schema.labels).run()
  testDb.delete(schema.lists).run()
  initializeTestDatabase()
}