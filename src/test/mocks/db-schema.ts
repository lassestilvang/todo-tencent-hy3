// Mock schema for testing - re-exports the real schema
// but avoids the ESM import issues with better-sqlite3
export * from '@/lib/db/schema'