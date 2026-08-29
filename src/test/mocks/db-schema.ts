// Mock schema for testing - re-exports the real schema
// but avoids the ESM import issues with better-sqlite3
import * as schema from '@/lib/db/schema'

export * from '@/lib/db/schema'