import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/tasks'

// Set up test database before importing tasks module
setDbInstanceForTesting(testDb)

import { getTasks, createTask, getTask, toggleTaskComplete, deleteTask, getLists, createList, getLabels, createLabel, deleteList, deleteLabel } from '@/lib/tasks'

beforeAll(() => {
  runTestMigrations()
  initializeTestDatabase()
})

beforeEach(() => {
  clearTestDatabase()
})

describe('getTasks function', () => {
  beforeEach(async () => {
    // Create test tasks
    await createTask({
      name: 'Test Task 1',
      description: 'Description for task 1',
      date: '2025-01-15',
      estimate: 60,
      priority: 'high',
      list_id: 'inbox',
    })
    await createTask({
      name: 'Test Task 2',
      description: 'Description for task 2',
      date: '2025-01-20',
      estimate: 30,
      priority: 'medium',
      list_id: 'inbox',
      completed: true,
    })
  })

  it('returns all tasks when no options provided', async () => {
    const result = await getTasks()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Test Task 1')
    expect(result[1].name).toBe('Test Task 2')
  })

  it('filters tasks by listId', async () => {
    const result = await getTasks({ listId: 'inbox' })

    expect(result).toHaveLength(2)
    expect(result.every(task => task.list_id === 'inbox')).toBe(true)
  })

  it('filters tasks by completed status', async () => {
    const result = await getTasks({ completed: false })

    expect(result).toHaveLength(1)
    expect(result[0].completed).toBe(false)
  })

  it('filters tasks by search', async () => {
    const result = await getTasks({ search: 'Test Task 1' })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Task 1')
  })

  it('sorts tasks by priority', async () => {
    const result = await getTasks()

    expect(result[0].priority).toBe('high')
    expect(result[1].priority).toBe('medium')
  })
})

describe('Task CRUD operations', () => {
  it('creates a task and retrieves it', async () => {
    const task = await createTask({
      name: 'New Task',
      description: 'Test description',
      priority: 'high',
      estimate: 45,
    })

    expect(task.id).toBeDefined()
    expect(task.name).toBe('New Task')
    expect(task.priority).toBe('high')
    expect(task.estimate).toBe(45)
    expect(task.completed).toBe(false)

    const retrieved = await getTask(task.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('New Task')
  })

  it('toggles task completion', async () => {
    const task = await createTask({ name: 'Toggle Task' })
    expect(task.completed).toBe(false)

    await toggleTaskComplete(task.id)
    const toggled = await getTask(task.id)
    expect(toggled!.completed).toBe(true)
    expect(toggled!.completed_at).toBeDefined()

    await toggleTaskComplete(task.id)
    const untoggled = await getTask(task.id)
    expect(untoggled!.completed).toBe(false)
    expect(untoggled!.completed_at).toBeNull()
  })

  it('deletes a task', async () => {
    const task = await createTask({ name: 'Delete Me' })
    await deleteTask(task.id)
    const deleted = await getTask(task.id)
    expect(deleted).toBeUndefined()
  })
})

describe('List operations', () => {
  it('gets lists with task counts', () => {
    const lists = getLists()
    expect(lists).toHaveLength(1)
    expect(lists[0].id).toBe('inbox')
    expect(lists[0].task_count).toBe(0)
    expect(lists[0].incomplete_count).toBe(0)
  })

  it('creates a new list', () => {
    const list = createList('Test List', '#ff0000', '🧪')
    expect(list.id).toBeDefined()
    expect(list.name).toBe('Test List')
    expect(list.color).toBe('#ff0000')
    expect(list.emoji).toBe('🧪')

    const lists = getLists()
    expect(lists).toHaveLength(2)
  })

  it('deletes a list', () => {
    const list = createList('To Delete', '#000000', '🗑️')
    deleteList(list.id)
    const lists = getLists()
    expect(lists.find(l => l.id === list.id)).toBeUndefined()
  })
})

describe('Label operations', () => {
  it('gets labels', () => {
    const labels = getLabels()
    expect(labels).toHaveLength(0)
  })

  it('creates a new label', () => {
    const label = createLabel('Test Label', '#00ff00', '🏷️')
    expect(label.id).toBeDefined()
    expect(label.name).toBe('Test Label')
    expect(label.color).toBe('#00ff00')
    expect(label.icon).toBe('🏷️')

    const labels = getLabels()
    expect(labels).toHaveLength(1)
  })

  it('deletes a label', () => {
    const label = createLabel('To Delete', '#000000', '🗑️')
    deleteLabel(label.id)
    const labels = getLabels()
    expect(labels.find(l => l.id === label.id)).toBeUndefined()
  })
})