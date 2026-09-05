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
 * Falls back to messaging the open tab if available.
 */
async function addTask(taskText) {
  try {
    // Try to send to the open TaskFlow tab first (real-time update)
    if (taskflowTabId) {
      sendMessageToTaskflow({
        type: 'TASKFLOW_ADD_TASK',
        payload: { text: taskText },
      })
    }

    // Also sync to storage for persistence
    const { tasks = [] } = await chrome.storage.local.get('tasks')
    tasks.push({
      text: taskText,
      createdAt: new Date().toISOString(),
      synced: false,
    })
    await chrome.storage.local.set({ tasks })
  } catch (error) {
    console.error('Failed to add task:', error)
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
    // Sync stored tasks to the TaskFlow web app
    chrome.storage.local.get('tasks').then(({ tasks = [] }) => {
      const unsynced = tasks.filter((t) => !t.synced)
      sendResponse({ unsynced, total: tasks.length })
    })
    return true // Keep message channel open for async response
  }

  if (message.type === 'TASKFLOW_SET_TAB') {
    taskflowTabId = sender.tab?.id
    sendResponse({ success: true })
    return true
  }
})
