/**
 * @jest-environment node
 *
 * The route under test is built on NextRequest, which
 * extends the fetch API's Request — jsdom has no Request,
 * Node does.
 */
"use strict"

import { NextRequest } from 'next/server'
import {
  CONNECTORS,
  getConnector,
  type ConnectorCredentials,
} from '@/lib/workflows/connectors'
import { loadConnectorCredentials } from '@/lib/workflows/credentials'
import { executeWorkflow, type Workflow } from '@/lib/workflows/engine'
import { POST as postConnectorMessage } from '@/app/api/workflows/connectors/route'

const okJson = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
})

const errorJson = (status: number, data: unknown) => ({
  ok: false,
  status,
  json: async () => data,
})

const slackCredentials: ConnectorCredentials = {
  slack: { webhookUrl: 'https://hooks.slack.com/services/T1/B1/secret' },
}

const githubCredentials: ConnectorCredentials = {
  github: { token: 'ghp_token', repo: 'acme/taskflow' },
}

const emailCredentials: ConnectorCredentials = {
  email: {
    apiKey: 'email-key',
    apiUrl: 'https://api.mail.example/send',
    from: 'taskflow@example.com',
    to: 'ops@example.com',
  },
}

describe('Connector registry', () => {
  it('registers the github, slack and email connectors', () => {
    expect(CONNECTORS.map((connector) => connector.id)).toEqual([
      'github',
      'slack',
      'email',
    ])
  })

  it('looks connectors up by id', () => {
    expect(getConnector('slack')?.name).toBe('Slack')
    expect(getConnector('nope')).toBeUndefined()
  })
})

describe('Slack connector', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('reports configured when a webhook URL is present', () => {
    const connector = getConnector('slack')!

    expect(connector.isConfigured(slackCredentials)).toBe(true)
    expect(connector.isConfigured({})).toBe(false)
  })

  it('posts the message to the webhook', async () => {
    const calls: [string, RequestInit?][] = []
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push([url, init])
      return Promise.resolve(okJson({}))
    })

    const delivery = await getConnector('slack')!.deliver(
      slackCredentials,
      { title: 'Deploy done', body: 'The deploy finished' }
    )

    expect(delivery).toEqual({ success: true, status: 200 })
    expect(calls[0][0]).toBe(slackCredentials.slack!.webhookUrl)
    expect(calls[0][1]?.method).toBe('POST')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      text: 'Deploy done\n\nThe deploy finished',
    })
  })

  it('appends the task reference to the body', async () => {
    global.fetch = jest.fn(() => Promise.resolve(okJson({})))

    await getConnector('slack')!.deliver(slackCredentials, {
      title: 'Task done',
      body: 'A task finished',
      taskName: 'Write report',
      taskUrl: 'http://localhost/task/1',
    })

    const body = JSON.parse(
      String((global.fetch as jest.Mock).mock.calls[0][1].body)
    )
    expect(body.text).toContain('Task: Write report')
    expect(body.text).toContain('http://localhost/task/1')
  })

  it('refuses to deliver when unconfigured', async () => {
    const delivery = await getConnector('slack')!.deliver(
      {},
      { title: 'Hi', body: 'There' }
    )

    expect(delivery).toEqual({
      success: false,
      error: 'Slack connector is not configured',
    })
  })

  it('surfaces the provider error message', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(errorJson(403, { message: 'invalid_token' }))
    )

    const delivery = await getConnector('slack')!.deliver(
      slackCredentials,
      { title: 'Hi', body: 'There' }
    )

    expect(delivery).toEqual({
      success: false,
      status: 403,
      error: 'invalid_token',
    })
  })
})

describe('GitHub connector', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('reports configured when token and repo are present', () => {
    const connector = getConnector('github')!

    expect(connector.isConfigured(githubCredentials)).toBe(true)
    expect(connector.isConfigured({ github: { token: 'x' } })).toBe(false)
  })

  it('creates an issue in the configured repository', async () => {
    const calls: [string, RequestInit?][] = []
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push([url, init])
      return Promise.resolve(okJson({ number: 42 }))
    })

    const delivery = await getConnector('github')!.deliver(
      githubCredentials,
      { title: 'Bug in sync', body: 'Sync duplicated tasks' }
    )

    expect(delivery).toEqual({ success: true, status: 200 })
    expect(calls[0][0]).toBe(
      'https://api.github.com/repos/acme/taskflow/issues'
    )
    expect(calls[0][1]?.method).toBe('POST')
    expect((calls[0][1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer ghp_token'
    )
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      title: 'Bug in sync',
      body: 'Sync duplicated tasks',
    })
  })

  it('rejects a repo that is not owner/name', async () => {
    const delivery = await getConnector('github')!.deliver(
      { github: { token: 'x', repo: 'no-slash' } },
      { title: 'Hi', body: 'There' }
    )

    expect(delivery).toEqual({
      success: false,
      error: 'GitHub repo must be "owner/repository"',
    })
  })
})

describe('Email connector', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('reports configured only with complete credentials', () => {
    const connector = getConnector('email')!

    expect(connector.isConfigured(emailCredentials)).toBe(true)
    expect(
      connector.isConfigured({ email: { apiKey: 'k', apiUrl: 'u' } })
    ).toBe(false)
  })

  it('sends the message through the mail API', async () => {
    const calls: [string, RequestInit?][] = []
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push([url, init])
      return Promise.resolve(okJson({ id: 'msg-1' }))
    })

    const delivery = await getConnector('email')!.deliver(
      emailCredentials,
      { title: 'Reminder', body: 'Task due soon' }
    )

    expect(delivery).toEqual({ success: true, status: 200 })
    expect(calls[0][0]).toBe(emailCredentials.email!.apiUrl)
    expect((calls[0][1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer email-key'
    )
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      from: 'taskflow@example.com',
      to: 'ops@example.com',
      subject: 'Reminder',
      text: 'Task due soon',
    })
  })
})

describe('Connector credentials', () => {
  const ENV_KEYS = [
    'GITHUB_TOKEN',
    'GITHUB_REPO',
    'SLACK_WEBHOOK_URL',
    'EMAIL_API_KEY',
    'EMAIL_API_URL',
    'EMAIL_FROM',
    'EMAIL_TO',
  ]
  const saved: Record<string, string | undefined> = {}

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key]
  })

  it('loads every connector from the environment', () => {
    process.env.GITHUB_TOKEN = 'ghp_token'
    process.env.GITHUB_REPO = 'acme/taskflow'
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/x'
    process.env.EMAIL_API_KEY = 'key'
    process.env.EMAIL_API_URL = 'https://api.mail.example/send'
    process.env.EMAIL_FROM = 'taskflow@example.com'
    process.env.EMAIL_TO = 'ops@example.com'

    expect(loadConnectorCredentials()).toEqual({
      github: { token: 'ghp_token', repo: 'acme/taskflow' },
      slack: { webhookUrl: 'https://hooks.slack.com/x' },
      email: {
        apiKey: 'key',
        apiUrl: 'https://api.mail.example/send',
        from: 'taskflow@example.com',
        to: 'ops@example.com',
      },
    })
  })

  it('omits connectors with missing values', () => {
    process.env.GITHUB_TOKEN = 'ghp_token'
    process.env.SLACK_WEBHOOK_URL = ''

    const credentials = loadConnectorCredentials()

    // GitHub lacks GITHUB_REPO and Slack's URL is blank,
    // so neither connector is usable.
    expect(credentials.github).toBeUndefined()
    expect(credentials.slack).toBeUndefined()
    expect(credentials.email).toBeUndefined()
  })
})

describe('send_connector_message workflow action', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  function connectorWorkflow(
    config: Record<string, unknown>
  ): Workflow {
    return {
      id: 'wf-connector',
      name: 'Connector Workflow',
      description: '',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          triggerType: 'task_completed',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'action-1',
          type: 'action',
          actionType: 'send_connector_message',
          config,
          position: { x: 100, y: 0 },
        },
      ],
      edges: [{ id: 'edge-1', source: 'trigger-1', target: 'action-1' }],
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      runCount: 0,
    }
  }

  it('delivers through the server-side connectors route', async () => {
    const calls: [string, RequestInit?][] = []
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push([url, init])
      return Promise.resolve(okJson({ success: true, status: 200 }))
    })

    const result = await executeWorkflow(
      connectorWorkflow({
        connector: 'slack',
        title: 'Task completed: ${taskName}',
        body: 'The task is done',
        taskName: '${taskName}',
      }),
      { taskName: 'Write report' }
    )

    expect(result.success).toBe(true)
    const action = result.results.find((r) => r.nodeId === 'action-1')
    expect(action?.success).toBe(true)
    expect(action?.data).toEqual({ connector: 'slack', status: 200 })

    expect(calls[0][0]).toBe('/api/workflows/connectors')
    expect(calls[0][1]?.method).toBe('POST')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      connector: 'slack',
      title: 'Task completed: Write report',
      body: 'The task is done',
      taskName: 'Write report',
      taskUrl: undefined,
    })
  })

  it('fails when the connectors route reports an error', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        errorJson(502, {
          success: false,
          error: 'Slack connector is not configured',
        })
      )
    )

    const result = await executeWorkflow(
      connectorWorkflow({
        connector: 'slack',
        title: 'Task completed',
        body: 'The task is done',
      }),
      {}
    )

    const action = result.results.find((r) => r.nodeId === 'action-1')
    expect(action?.success).toBe(false)
    expect(action?.error).toBe('Slack connector is not configured')
  })
})

describe('Connectors API route', () => {
  const originalFetch = global.fetch
  const ENV_KEYS = [
    'GITHUB_TOKEN',
    'GITHUB_REPO',
    'SLACK_WEBHOOK_URL',
    'EMAIL_API_KEY',
    'EMAIL_API_URL',
    'EMAIL_FROM',
    'EMAIL_TO',
  ]
  const saved: Record<string, string | undefined> = {}

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  beforeEach(() => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T1/B1/x'
  })

  afterEach(() => {
    global.fetch = originalFetch
    for (const key of ENV_KEYS) delete process.env[key]
  })

  function post(body: unknown): NextRequest {
    return new NextRequest(
      'http://localhost/api/workflows/connectors',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
  }

  it('delivers a message through the configured connector', async () => {
    global.fetch = jest.fn(() => Promise.resolve(okJson({})))

    const response = await postConnectorMessage(
      post({
        connector: 'slack',
        title: 'Hello',
        body: 'World',
        taskName: 'Task A',
        taskUrl: 'http://localhost/task/1',
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      status: 200,
    })
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      process.env.SLACK_WEBHOOK_URL
    )
  })

  it('rejects an unknown connector', async () => {
    const response = await postConnectorMessage(
      post({ connector: 'discord', title: 'Hi', body: 'There' })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Unknown connector: discord',
    })
  })

  it('rejects an unconfigured connector without delivering', async () => {
    global.fetch = jest.fn()
    delete process.env.SLACK_WEBHOOK_URL

    const response = await postConnectorMessage(
      post({ connector: 'github', title: 'Hi', body: 'There' })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'GitHub connector is not configured',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects a malformed message', async () => {
    const response = await postConnectorMessage(post({ connector: 'slack' }))

    expect(response.status).toBe(400)
  })

  it('maps a failed delivery to a bad gateway', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(errorJson(403, { message: 'invalid_token' }))
    )

    const response = await postConnectorMessage(
      post({ connector: 'slack', title: 'Hi', body: 'There' })
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      error: 'invalid_token',
    })
  })

  it('maps a throwing delivery to a bad gateway', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network down')))

    const response = await postConnectorMessage(
      post({ connector: 'slack', title: 'Hi', body: 'There' })
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      error: 'network down',
    })
  })
})
