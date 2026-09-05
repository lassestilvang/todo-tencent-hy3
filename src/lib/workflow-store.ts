/**
 * Shared workflow store.
 *
 * In-memory storage for workflows. In a production deployment this
 * would be replaced with a database, but for this single-process app
 * an exported array is sufficient and avoids the need for a separate
 * table in the SQLite schema.
 */

import type { Workflow } from '@/lib/workflows/engine'

export const workflows: Workflow[] = []
