import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/tasks'

// Set up test database before importing tasks module
setDbInstanceForTesting(testDb)

import { exportAllData, importAllData, createTask, createList, createLabel, addTaskLabel, type ExportData } from '@/lib/tasks'

describe('Data Export/Import', () => {
  beforeAll(() => {
    runTestMigrations()
    initializeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
  })

  describe('exportAllData', () => {
    it('should export data in correct format', async () => {
      // Create test list
      const list = createList('Test List', '#ff0000', '🧪')

      // Create test task
      const task = createTask({
        name: 'Test Task',
        description: 'Test Description',
        list_id: list.id,
        priority: 'high',
        estimate: 30
      })

      // Create test label
      const label = createLabel('Test Label', '#00ff00', '🏷️')

      // Add label to task
      addTaskLabel(task.id, label.id)

      // Export the data
      const exportData = await exportAllData()

      // Verify export structure
      expect(exportData).toHaveProperty('version', 1)
      expect(exportData).toHaveProperty('exportedAt')
      expect(Array.isArray(exportData.lists)).toBe(true)
      expect(Array.isArray(exportData.labels)).toBe(true)
      expect(Array.isArray(exportData.tasks)).toBe(true)

      // Verify data was exported (should have inbox + test list)
      expect(exportData.lists).toHaveLength(2)
      // Find our test list (not the default inbox)
      const testList = exportData.lists.find(l => l.id === list.id)
      expect(testList).toBeDefined()
      expect(testList).toHaveProperty('id', list.id)
      expect(testList).toHaveProperty('name', 'Test List')

      expect(exportData.tasks).toHaveLength(1)
      expect(exportData.tasks[0]).toHaveProperty('name', 'Test Task')
      expect(exportData.tasks[0]).toHaveProperty('description', 'Test Description')
      expect(exportData.tasks[0]).toHaveProperty('priority', 'high')
      expect(exportData.tasks[0]).toHaveProperty('estimate', 30)

      expect(exportData.labels).toHaveLength(1)
      expect(exportData.labels[0]).toHaveProperty('name', 'Test Label')
    })

    it('should export empty arrays when no user data exists (only inbox)', async () => {
      const exportData = await exportAllData()

      // Should have the default inbox list
      expect(exportData.lists).toHaveLength(1)
      expect(exportData.lists[0]).toHaveProperty('id', 'inbox')
      expect(exportData.labels).toEqual([])
      expect(exportData.tasks).toEqual([])
      expect(exportData.taskLabels).toEqual([])
      expect(exportData.taskAttachments).toEqual([])
      expect(exportData.taskReminders).toEqual([])
      expect(exportData.taskDependencies).toEqual([])
      expect(exportData.taskLogs).toEqual([])
    })
  })

  describe('importAllData', () => {
    it('should handle empty data correctly', async () => {
      const emptyData: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        lists: [],
        labels: [],
        tasks: [],
        taskLabels: [],
        taskAttachments: [],
        taskReminders: [],
        taskDependencies: [],
        taskLogs: []
      }

      const importResult = await importAllData(emptyData)

      expect(importResult.success).toBe(true)
      expect(importResult.errors).toHaveLength(0)
    })

    it('should handle import with onConflict skip option', async () => {
      const exportData: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        lists: [],
        labels: [],
        tasks: [],
        taskLabels: [],
        taskAttachments: [],
        taskReminders: [],
        taskDependencies: [],
        taskLogs: []
      }

      const result = await importAllData(exportData, { merge: true, onConflict: 'skip' })
      expect(result.success).toBe(true)
    })
  })
})