// Test setup for Jest
// Mock window.matchMedia before any imports
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock @/lib/db before any tests run - must be done before importing @/lib/tasks
jest.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const Database = (await import('better-sqlite3')).default
  const schema = await import('@/lib/db/schema')

  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const testDb = drizzle(sqlite, { schema })

  return {
    getDb: () => testDb,
    runMigrations: jest.fn(),
    initializeDatabase: () => {
      const now = new Date().toISOString()
      testDb.insert(schema.lists).values({
        id: 'inbox',
        name: 'Inbox',
        color: '#6366f1',
        emoji: '📥',
        createdAt: now,
        updatedAt: now,
      }).run()
    },
    closeDb: jest.fn(),
    ...schema,
  }
})

jest.mock('@/lib/db/index', async () => {
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const Database = (await import('better-sqlite3')).default
  const schema = await import('@/lib/db/schema')

  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const testDb = drizzle(sqlite, { schema })

  return {
    getDb: () => testDb,
    runMigrations: jest.fn(),
    initializeDatabase: () => {
      const now = new Date().toISOString()
      testDb.insert(schema.lists).values({
        id: 'inbox',
        name: 'Inbox',
        color: '#6366f1',
        emoji: '📥',
        createdAt: now,
        updatedAt: now,
      }).run()
    },
    closeDb: jest.fn(),
    ...schema,
  }
})

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
})

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
})

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  writable: true,
  value: {
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
  },
})