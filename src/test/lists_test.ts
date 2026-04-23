import { describe, test, expect, beforeEach } from 'bun:test'
import { getDb, closeDb } from '@/lib/db'
import { createList, getLists, updateList, deleteList } from '@/lib/tasks'

describe('List Tests', () => {
  beforeEach(() => {
    closeDb()
    const fs = require('fs')
    const path = require('path')
    const dbPath = process.env.TEST_DB_PATH || path.join(__dirname, '../../tasks.json')
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  test('should create list', () => {
    const list = createList('Work', '#6366f1', '💼')
    expect(list.name).toBe('Work')
    expect(list.color).toBe('#6366f1')
    expect(list.emoji).toBe('💼')
  })

  test('should get lists', () => {
    createList('Work', '#6366f1', '💼')
    createList('Personal', '#22c55e', '🏠')
    const lists = getLists()
    // Including Inbox, should be 3
    expect(lists.length).toBe(3)
  })

  test('should update list', () => {
    const list = createList('Original', '#6366f1', '📋')
    updateList(list.id, { name: 'Updated', color: '#22c55e' })
    const lists = getLists()
    const updated = lists.find(l => l.id === list.id)
    expect(updated?.name).toBe('Updated')
    expect(updated?.color).toBe('#22c55e')
  })

  test('should delete list', () => {
    const list = createList('To Delete', '#ff0000', '🗑️')
    deleteList(list.id)
    const lists = getLists()
    const deleted = lists.find(l => l.id === list.id)
    expect(deleted).toBeUndefined()
  })

  test('should include inbox', () => {
    const lists = getLists()
    const inbox = lists.find(l => l.id === 'inbox')
    expect(inbox).toBeDefined()
    expect(inbox?.name).toBe('Inbox')
  })
})
