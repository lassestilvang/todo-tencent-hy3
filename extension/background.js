/**
 * TaskFlow Browser Extension — Background Service Worker
 *
 * Handles:
 * - Context menu creation for "Add to TaskFlow"
 * - Keyboard shortcut for adding selected text
 * - Sync with the TaskFlow web app via extension messaging
 */

const TASKFLOW_ORIGIN = 'http://localhost:3000'

let taskflowTabId = null

/**
 * Find or create a TaskFlow tab.
 */
async function getTaskflowTab() {
  const tabs = await chrome.tabs.query({ url: `${TASKFLOW_ORIGIN}/*` })
  if (tabs.length > 0) {
    return tabs[0]
  }
  // Open a new tab
  const tab = await chrome.tabs.create({
    url: `${TASKFLOW_ORIGIN}/today`,
    active: false,
  })
  taskflowTabId = tab.id
  return tab
}

/**
 * Send a message to the TaskFlow tab.
 */
function sendMessageToTaskflow(message) {
  if (taskflowTabId) {
    chrome.tabs.sendMessage(taskflowTabId, message).catch(() => {
      // Tab might be closed — find again
      taskflowTabId = null
    })
  }
}

/**
 * Add text as a new task via the TaskFlow API.
 * POSTs directly to the API so the task is created immediately,
 * even if no TaskFlow tab is open. Falls back to
 * chrome.storage.local only when the network/API is unavailable,
 * and queues a sync for the next online window.
 */
async function addTask(taskText) {
  // Load the configured TaskFlow URL
  const { taskflowUrl } = await chrome.storage.sync.get({
    taskflowUrl: 'http://localhost:3000',
  })

  const taskData = {
    name: taskText,
    source: 'browser-extension',
  }

  try {
    const response = await fetch(`${taskflowUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData),
    })

    if (response.ok) {
      // Notify the open TaskFlow tab (if any) so it refreshes its SWR cache
      if (taskflowTabId) {
        sendMessageToTaskflow({ type: 'TASKFLOW_REFRESH', payload: {} })
      }
      return
    }

    throw new Error('HTTP ' + response.status)
  } catch (error) {
    console.warn('Extension API add failed, queueing for sync:', error)
    // Queue the task locally for background sync
    const { tasks = [] } = await chrome.storage.local.get('tasks')
    tasks.push({
      name: taskText,
      source: 'browser-extension',
      createdAt: new Date().toISOString(),
      synced: false,
    })
    await chrome.storage.local.set({ tasks })
  }
}

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'taskflow-add-selection',
    title: 'Add to TaskFlow: "%s"',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'taskflow-add-page',
    title: 'Add this page to TaskFlow',
    contexts: ['page'],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'taskflow-add-selection' && info.selectionText) {
    addTask(info.selectionText)
    // Show a brief notification
    chrome.notifications.create({
      type: 'basic',
      title: 'TaskFlow',
      message: 'Task added: ' + info.selectionText.slice(0, 50) + '...',
      iconUrl: '/extension/icons/icon-48.png',
    })
  }
  if (info.menuItemId === 'taskflow-add-page') {
    const pageTitle = tab.title || tab.url
    addTask(pageTitle + ' — ' + tab.url)
    chrome.notifications.create({
      type: 'basic',
      title: 'TaskFlow',
      message: 'Page saved to TaskFlow',
      iconUrl: '/extension/icons/icon-48.png',
    })
  }
})

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'add-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0]
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection().toString(),
        })
        .then((results) => {
          const selection = results[0]?.result
          if (selection) {
            addTask(selection)
          }
        })
    })
  }
})

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TASKFLOW_SYNC') {
    // POST any queued (unsynced) tasks to the API
    syncQueuedTasks().then((result) => {
      sendResponse(result)
    })
    return true // Keep message channel open for async response
  }

  if (message.type === 'TASKFLOW_SET_TAB') {
    taskflowTabId = sender.tab?.id
    sendResponse({ success: true })
    return true
  }
})

/**
 * POST all locally-queued (unsynced) tasks to the TaskFlow API.
 * Successfully-synced tasks are marked and removed from local storage.
 */
async function syncQueuedTasks() {
  const { taskflowUrl } = await chrome.storage.sync.get({
    taskflowUrl: 'http://localhost:3000',
  })

  const { tasks = [] } = await chrome.storage.local.get('tasks')
  const unsynced = tasks.filter((t) => !t.synced)

  let syncedCount = 0
  let failedCount = 0

  for (const task of unsynced) {
    try {
      const response = await fetch(`${taskflowUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: task.name || task.text,
          source: task.source || 'browser-extension',
        }),
      })

      if (response.ok) {
        task.synced = true
        syncedCount++
      } else {
        failedCount++
      }
    } catch (error) {
      failedCount++
    }
  }

  await chrome.storage.local.set({ tasks })

  // Notify the open TaskFlow tab so it refreshes its cache
  if (taskflowTabId && syncedCount > 0) {
    sendMessageToTaskflow({
      type: 'TASKFLOW_REFRESH',
      payload: { count: syncedCount },
    })
  }

  return { synced: syncedCount, failed: failedCount, total: tasks.length }
}

// Attempt to sync queued tasks when the extension starts up
chrome.runtime.onStartup.addListener(() => {
  syncQueuedTasks().catch(() => {})
})

// Also expose a sync trigger the popup can call directly
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TASKFLOW_SYNC_NOW') {
    syncQueuedTasks().then((result) => {
      sendResponse(result)
    })
    return true
  }
})
