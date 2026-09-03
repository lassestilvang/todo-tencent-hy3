import { testDb, runTestMigrations, initializeTestDatabase, clearTestDatabase } from './db-test'
import { setDbInstanceForTesting } from '@/lib/tasks'

// Set up test database before importing tasks module
setDbInstanceForTesting(testDb)

import { getTasks, createTask, getTask, toggleTaskComplete, deleteTask, getLists, createList, getLabels, createLabel, updateLabel, deleteList, deleteLabel, getTaskDependencies, addTaskDependency, removeTaskDependency, canCompleteTask } from '@/lib/tasks'

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
  it('gets lists with task counts', async () => {
    const lists = await getLists()
    expect(lists).toHaveLength(1)
    expect(lists[0].id).toBe('inbox')
    expect(lists[0].task_count).toBe(0)
    expect(lists[0].incomplete_count).toBe(0)
  })

  it('creates a new list', async () => {
    const list = createList('Test List', '#ff0000', '🧪')
    expect(list.id).toBeDefined()
    expect(list.name).toBe('Test List')
    expect(list.color).toBe('#ff0000')
    expect(list.emoji).toBe('🧪')

    const lists = await getLists()
    expect(lists).toHaveLength(2)
  })

  it('deletes a list', async () => {
    const list = createList('To Delete', '#000000', '🗑️')
    deleteList(list.id)
    const lists = await getLists()
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

  it('updates a label', () => {
    const label = createLabel('Original', '#000000', '🏷️')
    const updated = updateLabel(label.id, { name: 'Renamed', color: '#ffffff' })
    expect(updated).toMatchObject({ id: label.id, name: 'Renamed', color: '#ffffff', icon: '🏷️' })

    const stored = getLabels().find(l => l.id === label.id)
    expect(stored).toMatchObject({ name: 'Renamed', color: '#ffffff' })
  })

  it('clears a label icon as an empty string', () => {
    const label = createLabel('Icon Label', '#000000', '🏷️')
    const updated = updateLabel(label.id, { icon: null })
    expect(updated).toMatchObject({ icon: '' })
  })

  it('returns null when updating a missing label', () => {
    expect(updateLabel('does-not-exist', { name: 'Nope' })).toBeNull()
  })
})

describe('Task Dependencies', () => {
  it('tracks blocking and blocked tasks from each perspective', async () => {
    const blocker = await createTask({ name: 'Blocker' })
    const blocked = await createTask({ name: 'Blocked' })

    addTaskDependency(blocker.id, blocked.id, 'blocks')

    // From the blocked task: the blocker is "blocking"
    const fromBlocked = getTaskDependencies(blocked.id)
    expect(fromBlocked.blocking).toHaveLength(1)
    expect(fromBlocked.blocking[0].id).toBe(blocker.id)
    expect(fromBlocked.blocked).toHaveLength(0)

    // From the blocker: the other task is "blocked"
    const fromBlocker = getTaskDependencies(blocker.id)
    expect(fromBlocker.blocked).toHaveLength(1)
    expect(fromBlocker.blocked[0].id).toBe(blocked.id)
    expect(fromBlocker.blocking).toHaveLength(0)
  })

  it('prevents completion while a blocks-dependency is unfinished', async () => {
    const blocker = await createTask({ name: 'Blocker' })
    const blocked = await createTask({ name: 'Blocked' })

    addTaskDependency(blocker.id, blocked.id, 'blocks')

    const check = canCompleteTask(blocked.id)
    expect(check.canComplete).toBe(false)
    expect(check.blockingTasks).toHaveLength(1)
    expect(check.blockingTasks[0].id).toBe(blocker.id)

    // Once the blocker is done, the task can complete
    await toggleTaskComplete(blocker.id)
    const after = canCompleteTask(blocked.id)
    expect(after.canComplete).toBe(true)
    expect(after.blockingTasks).toHaveLength(0)
  })

  it('ignores non-blocks dependencies for completion', async () => {
    const other = await createTask({ name: 'Related' })
    const task = await createTask({ name: 'Task' })

    addTaskDependency(other.id, task.id, 'relates')

    const check = canCompleteTask(task.id)
    expect(check.canComplete).toBe(true)
    expect(check.blockingTasks).toHaveLength(0)
  })

  it('removes a dependency', async () => {
    const blocker = await createTask({ name: 'Blocker' })
    const blocked = await createTask({ name: 'Blocked' })

    addTaskDependency(blocker.id, blocked.id, 'blocks')
    expect(getTaskDependencies(blocked.id).blocking).toHaveLength(1)

    removeTaskDependency(blocker.id, blocked.id)
    expect(getTaskDependencies(blocked.id).blocking).toHaveLength(0)
    expect(getTaskDependencies(blocker.id).blocked).toHaveLength(0)
  })
})