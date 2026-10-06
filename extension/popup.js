/**
 * TaskFlow Browser Extension — Popup Script
 *
 * Handles the browser action popup: quick task entry
 * and a button to open TaskFlow in a new tab.
 *
 * Supports sending tasks directly to the TaskFlow API
 * when the user has configured their TaskFlow URL and API key.
 */

document.addEventListener('DOMContentLoaded', function () {
  const taskInput = document.getElementById('task-input')
  const deadlineInput = document.getElementById('task-deadline')
  const estimateInput = document.getElementById('task-estimate')
  const addBtn = document.getElementById('add-btn')
  const syncBtn = document.getElementById('sync-btn')
  const openBtn = document.getElementById('open-btn')
  const statusEl = document.getElementById('status')

  /** @type {{taskflowUrl: string}|null} */
  let settings = null

  function showStatus(message, isError = false) {
    statusEl.textContent = message
    statusEl.className = isError ? 'error' : 'success'
    setTimeout(() => {
      statusEl.textContent = ''
      statusEl.className = ''
    }, 3000)
  }

  // Load settings on startup
  chrome.storage.sync.get(
    { taskflowUrl: 'http://localhost:3000' },
    function (items) {
      settings = items
    }
  )

  /**
   * Send task to TaskFlow via the API endpoint.
   * Falls back to background messaging if the API is unavailable.
   */
  function sendTaskToApi(task) {
    const baseUrl = (settings && settings.taskflowUrl) || 'http://localhost:3000'

    return fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: task.text,
        deadline: task.deadline || undefined,
        estimate: task.estimate || undefined,
        source: 'browser-extension',
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status)
        }
        return res.json()
      })
      .catch(function (err) {
        console.warn('Direct API add failed, falling back to messaging:', err)
        // Fall back to background messaging
        return new Promise(function (resolve) {
          chrome.runtime.sendMessage(
            { type: 'TASKFLOW_ADD_TASK', payload: task },
            function (response) {
              resolve(response || { fallback: true })
            }
          )
        })
      })
  }

  addBtn.addEventListener('click', function () {
    const text = taskInput.value.trim()
    if (!text) {
      showStatus('Please enter a task', true)
      return
    }

    const deadline = deadlineInput.value ? deadlineInput.value : null
    const estimate = estimateInput.value ? parseInt(estimateInput.value) : null

    const task = {
      text,
      deadline,
      estimate,
      createdAt: new Date().toISOString(),
    }

    addBtn.disabled = true
    addBtn.textContent = 'Sending...'

    sendTaskToApi(task)
      .then(function () {
        showStatus('Task added to TaskFlow!')
        taskInput.value = ''
        deadlineInput.value = ''
        estimateInput.value = ''
      })
      .catch(function (err) {
        showStatus('Failed to add task: ' + err.message, true)
      })
      .finally(function () {
        addBtn.disabled = false
        addBtn.textContent = 'Add Task'
      })
  })

  openBtn.addEventListener('click', function () {
    const baseUrl = (settings && settings.taskflowUrl) || 'http://localhost:3000'
    chrome.tabs.create({ url: baseUrl })
  })

  // Sync queued tasks button
  if (syncBtn) {
    syncBtn.addEventListener('click', function () {
      syncBtn.disabled = true
      syncBtn.textContent = 'Syncing...'

      chrome.runtime
        .sendMessage({ type: 'TASKFLOW_SYNC_NOW' })
        .then(function (response) {
          showStatus(
            'Synced ' +
              (response?.synced || 0) +
              ' task(s)' +
              (response?.failed ? ', ' + response.failed + ' failed' : '')
          )
        })
        .catch(function () {
          showStatus('Sync failed', true)
        })
        .finally(function () {
          syncBtn.disabled = false
          syncBtn.textContent = 'Sync now'
        })
    })
  }

  // Allow Enter key to submit (Shift+Enter for newline)
  taskInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addBtn.click()
    }
  })
})
