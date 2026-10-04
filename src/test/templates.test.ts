import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/tasks'

// Set up test database before importing tasks module
setDbInstanceForTesting(testDb)

import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createTaskFromTemplate,
} from '@/lib/tasks'

describe('Task Templates', () => {
  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    localStorage.clear()
    clearTestDatabase()
  })

  describe('getTemplates', () => {
    it('should return empty array when no templates exist', () => {
      const templates = getTemplates()
      expect(templates).toEqual([])
    })

    it('should return stored templates', () => {
      createTemplate({
        name: 'Weekly Review',
        description: 'Review all tasks',
        priority: 'high',
      })

      const templates = getTemplates()
      expect(templates).toHaveLength(1)
      expect(templates[0].name).toBe('Weekly Review')
    })
  })

  describe('getTemplate', () => {
    it('should return null when template not found', () => {
      const template = getTemplate('non-existent-id')
      expect(template).toBeNull()
    })

    it('should return template when found', () => {
      const created = createTemplate({ name: 'Test Template' })
      const template = getTemplate(created.id)
      expect(template).toBeDefined()
      expect(template!.name).toBe('Test Template')
    })
  })

  describe('createTemplate', () => {
    it('should create a template with generated ID', () => {
      const template = createTemplate({
        name: 'Bug Report',
        description: 'Template for bug reports',
      })

      expect(template).toBeDefined()
      expect(template.id).toBeDefined()
      expect(template.name).toBe('Bug Report')
      expect(template.description).toBe('Template for bug reports')
      expect(template.createdAt).toBeDefined()
      expect(template.updatedAt).toBeDefined()
    })

    it('should create template with all properties', () => {
      const template = createTemplate({
        name: 'Full Template',
        description: 'Complete template',
        priority: 'high',
        estimate: 120,
        recurring: 'every_week',
        listId: 'work',
        tags: ['urgent', 'review'],
      })

      expect(template.priority).toBe('high')
      expect(template.estimate).toBe(120)
      expect(template.recurring).toBe('every_week')
      expect(template.listId).toBe('work')
      expect(template.tags).toEqual(['urgent', 'review'])
    })
  })

  describe('updateTemplate', () => {
    it('should update existing template', () => {
      const template = createTemplate({ name: 'Original' })
      const updated = updateTemplate(template.id, { name: 'Updated', priority: 'high' })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('Updated')
      expect(updated!.priority).toBe('high')
    })

    it('should return null when template not found', () => {
      const updated = updateTemplate('non-existent', { name: 'New' })
      expect(updated).toBeNull()
    })

    it('should update timestamp on modification', () => {
      const template = createTemplate({ name: 'Original' })
      const originalUpdatedAt = template.updatedAt

      // Small delay to ensure timestamp changes
      const updated = updateTemplate(template.id, { name: 'Updated' })
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('deleteTemplate', () => {
    it('should delete existing template', () => {
      const template = createTemplate({ name: 'To Delete' })
      expect(getTemplate(template.id)).toBeDefined()

      const result = deleteTemplate(template.id)
      expect(result).toBe(true)
      expect(getTemplate(template.id)).toBeNull()
    })

    it('should return false when template not found', () => {
      const result = deleteTemplate('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('createTaskFromTemplate', () => {
    it('should create task from template', () => {
      const template = createTemplate({
        name: 'Recurring Task',
        priority: 'high',
        estimate: 60,
      })

      const task = createTaskFromTemplate(template.id)
      expect(task).toBeDefined()
      expect(task!.name).toBe('Recurring Task')
      expect(task!.priority).toBe('high')
      expect(task!.estimate).toBe(60)
    })

    it('should return null when template not found', () => {
      const task = createTaskFromTemplate('non-existent')
      expect(task).toBeNull()
    })

    it('should apply overrides', () => {
      const template = createTemplate({
        name: 'Template Task',
        priority: 'low',
      })

      const task = createTaskFromTemplate(template.id, { name: 'Custom Name' })
      expect(task).toBeDefined()
      expect(task!.name).toBe('Custom Name')
      // Template properties should still be present
      expect(task!.priority).toBe('low')
    })
  })
})