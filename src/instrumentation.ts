// Runs once when a Next.js server instance starts (see the instrumentation
// file convention). This is where we apply SQLite migrations so a fresh or
// existing database is brought up to the current schema before any request is
// handled — including the `task_templates` table added in migration 0001.
//
// Guarded to the Node.js runtime only: better-sqlite3 needs filesystem access,
// which the Edge runtime does not have. We also skip the production-build
// phase so `next build` never creates or touches the database file.
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return
  }

  const { runMigrations, initializeDatabase } = await import('@/lib/db')
  runMigrations()
  initializeDatabase()
}
