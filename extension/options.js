/**
 * TaskFlow Extension — Options Page Script
 *
 * Saves settings to chrome.storage.sync so they persist across devices.
 */

document.addEventListener('DOMContentLoaded', function () {
  const urlInput = document.getElementById('taskflow-url')
  const floatingBtn = document.getElementById('show-floating-btn')
  const contextMenu = document.getElementById('context-menu')
  const saveBtn = document.getElementById('save-btn')
  const statusEl = document.getElementById('status')

  function showStatus(message, isError) {
    if (isError === void 0) { isError = false }
    statusEl.textContent = message
    statusEl.className = isError ? 'error' : 'success'
    setTimeout(function () {
      statusEl.textContent = ''
      statusEl.className = ''
    }, 2000)
  }

  // Load saved settings
  chrome.storage.sync.get(
    {
      taskflowUrl: 'http://localhost:3000',
      showFloatingButton: true,
      contextMenuEnabled: true,
    },
    function (items) {
      urlInput.value = items.taskflowUrl
      floatingBtn.checked = items.showFloatingButton
      contextMenu.checked = items.contextMenuEnabled
    }
  )

  saveBtn.addEventListener('click', function () {
    // Validate URL
    try {
      new URL(urlInput.value)
    } catch {
      showStatus('Please enter a valid URL (e.g. http://localhost:3000)', true)
      return
    }

    var settings = {
      taskflowUrl: urlInput.value,
      showFloatingButton: floatingBtn.checked,
      contextMenuEnabled: contextMenu.checked,
    }

    chrome.storage.sync.set(settings, function () {
      showStatus('Settings saved!')
    })
  })
})
