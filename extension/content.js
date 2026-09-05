/**
 * TaskFlow Extension — Content Script
 *
 * Runs on every page. Listens for messages from the background script
 * and injects a small UI badge when the user is on a page that TaskFlow
 * could extract actionable content from.
 */

(function () {
  'use strict'

  var TASKFLOW_ORIGIN = 'http://localhost:3000'

  function updateTaskflowOrigin() {
    chrome.storage.sync.get({ taskflowUrl: 'http://localhost:3000' }, function (items) {
      TASKFLOW_ORIGIN = items.taskflowUrl
    })
  }

  // Register this tab as the TaskFlow tab when the user navigates to it
  if (window.location.origin === TASKFLOW_ORIGIN) {
    chrome.runtime.sendMessage({ type: 'TASKFLOW_SET_TAB' })

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (message.type === 'TASKFLOW_ADD_TASK') {
        // Dispatch a custom event that the TaskFlow app can listen for
        var event = new CustomEvent('taskflow-add-task', {
          detail: { text: message.payload.text },
        })
        document.dispatchEvent(event)
        sendResponse({ received: true })
        return true
      }
    })

    // Also listen for the extension's keyboard shortcut
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'Y') {
        // Allow TaskFlow to handle it
        var event = new CustomEvent('taskflow-hotkey', { detail: { key: 'quick-add' } })
        document.dispatchEvent(event)
      }
    })

    return
  }

  // On non-TaskFlow pages, inject a small floating button
  function shouldShowButton() {
    // Don't show on pages that are likely to conflict
    var url = window.location.href
    if (url.startsWith('http://localhost:')) return false
    if (url.startsWith('chrome://')) return false
    if (url.startsWith('about:')) return false
    return true
  }

  if (!shouldShowButton()) return

  // Check if user wants the floating button
  chrome.storage.sync.get({ showFloatingButton: true }, function (items) {
    if (!items.showFloatingButton) return

    // Create a floating button
    var button = document.createElement('button')
    button.id = 'taskflow-quick-add-btn'
    button.innerHTML = '📋'
    button.title = 'Add selection to TaskFlow (Ctrl+Shift+L)'
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: #6366f1;
      color: white;
      font-size: 20px;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    `

    button.addEventListener('mouseenter', function () {
      button.style.transform = 'scale(1.1)'
    })
    button.addEventListener('mouseleave', function () {
      button.style.transform = 'scale(1)'
    })

    button.addEventListener('click', function () {
      var selection = window.getSelection().toString().trim()
      if (selection) {
        chrome.runtime.sendMessage(
          { type: 'TASKFLOW_ADD_TASK', payload: { text: selection } },
          function () {
            button.innerHTML = '✅'
            setTimeout(function () { button.innerHTML = '📋' }, 1000)
          }
        )
      } else {
        // Add the page title + URL as a task
        chrome.runtime.sendMessage({
          type: 'TASKFLOW_ADD_TASK',
          payload: { text: document.title + ' — ' + window.location.href },
        })
        button.innerHTML = '✅'
        setTimeout(function () { button.innerHTML = '📋' }, 1000)
      }
    })

    // Inject styles and button once the page has loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(button)
      })
    } else {
      document.body.appendChild(button)
    }
  })
})()
