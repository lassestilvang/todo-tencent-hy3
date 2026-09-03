import { getDb } from './index'

// Database handle used by the collaboration stores (webhooks, share links,
// workspaces). Mirrors the override pattern in lib/tasks.ts so tests can point
// the stores at the migrated in-memory test database, and returns a chainable
// no-op while prerendering so `next build` never touches the database file.
type StoreDb = ReturnType<typeof getDb>

let dbOverride: StoreDb | null = null

export function setDbInstanceForTesting(db: StoreDb): void {
  dbOverride = db
}

export function clearDbInstanceForTesting(): void {
  dbOverride = null
}

function createBuildMock(): StoreDb {
  const emptyArray = () => []
  const emptyObject = () => undefined

  const whereMock = () => ({
    all: emptyArray,
    get: emptyObject,
    orderBy: () => ({
      all: emptyArray,
      get: emptyObject,
      limit: () => ({ all: emptyArray, get: emptyObject }),
    }),
    limit: () => ({ all: emptyArray, get: emptyObject }),
  })

  const fromMock = () => ({
    all: emptyArray,
    get: emptyObject,
    where: whereMock,
    orderBy: () => ({
      all: emptyArray,
      get: emptyObject,
      limit: () => ({ all: emptyArray, get: emptyObject }),
    }),
    limit: () => ({ all: emptyArray, get: emptyObject }),
  })

  return {
    select: () => ({ from: fromMock }),
    insert: () => ({
      values: () => ({
        run: () => ({}),
        onConflictDoNothing: () => ({ run: () => ({}) }),
        onConflictDoUpdate: () => ({ run: () => ({}) }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ run: () => ({}) }),
      }),
    }),
    delete: () => ({
      where: () => ({ run: () => ({}) }),
    }),
  } as unknown as StoreDb
}

export function getStoreDb(): StoreDb {
  if (dbOverride) return dbOverride

  // During build/prerendering, route handlers may be analyzed without a
  // request; return a no-op database so nothing touches the db file.
  if (typeof window === 'undefined' && process.env.NEXT_PHASE === 'phase-production-build') {
    return createBuildMock()
  }

  return getDb()
}
