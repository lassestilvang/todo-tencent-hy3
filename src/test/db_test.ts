import { describe, test, expect, beforeEach } from 'bun:test'
import { getDb } from '@/lib/db'
import type { List } from '@/types'

describe('Database Test', () => {
  beforeEach(() => {
    const db = getDb()
    db.tasks = []
    db.lists = [{ id: 'inbox', name: 'Inbox', color: '#6366f1', emoji: '📥', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]
    db.labels = []
    db.task_labels = []
    db.task_attachments = []
    db.task_reminders = []
    db.task_logs = []
  })

  test('should initialize database', () => {
    const db = getDb()
    expect(db).toBeDefined()
  })

  test('should have inbox list', () => {
    const db = getDb()
    const inbox = db.lists.find((l: List) => l.id === 'inbox')
    expect(inbox).toBeDefined()
    expect(inbox?.name).toBe('Inbox')
  })
})
