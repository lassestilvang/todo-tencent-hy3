"use strict"

import {
  executeWorkflow,
  WORKFLOW_TEMPLATES,
  type Workflow,
  type WorkflowNode,
  type WorkflowEdge,
  type ConditionType,
} from '@/lib/workflows/engine'

// The engine calls createTask/updateTask for its action nodes; we only assert
// on control flow here, so stub the transport layer.
jest.mock('@/lib/tasks-client', () => ({
  createTask: jest.fn(async (data: Record<string, unknown>) => ({ id: 'created-task', ...data })),
  updateTask: jest.fn(async () => undefined),
}))

import { createTask } from '@/lib/tasks-client'

const createTaskMock = createTask as jest.MockedFunction<typeof createTask>

function workflowWith(nodes: WorkflowNode[], edges: WorkflowEdge[]): Workflow {
  return {
    id: 'wf-test',
    name: 'Test Workflow',
    description: '',
    nodes,
    edges,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    runCount: 0,
  }
}

/** A workflow with a task_completed trigger wired to a single condition. */
function conditionWorkflow(
  conditionType: ConditionType,
  config: Record<string, unknown>
): Workflow {
  return workflowWith(
    [
      {
        id: 'trigger-1',
        type: 'trigger',
        triggerType: 'task_completed',
        config: {},
        position: { x: 0, y: 0 },
      },
      {
        id: 'condition-1',
        type: 'condition',
        conditionType,
        config,
        position: { x: 100, y: 0 },
      },
    ],
    [{ id: 'edge-1', source: 'trigger-1', target: 'condition-1' }]
  )
}

function conditionResult(results: { nodeId: string; data?: Record<string, unknown> }[]) {
  const node = results.find(r => r.nodeId === 'condition-1')
  return node?.data?.branch as string | undefined
}

describe('Workflow engine — conditions', () => {
  it('evaluates task_priority against the triggered task', async () => {
    const result = await executeWorkflow(
      conditionWorkflow('task_priority', { priority: 'high', taskId: '${taskId}' }),
      { taskId: 'task-1', taskPriority: 'high' }
    )

    expect(result.success).toBe(true)
    expect(conditionResult(result.results)).toBe('true')
  })

  it('returns false when task_priority does not match', async () => {
    const result = await executeWorkflow(
      conditionWorkflow('task_priority', { priority: 'high', taskId: '${taskId}' }),
      { taskId: 'task-1', taskPriority: 'low' }
    )

    expect(conditionResult(result.results)).toBe('false')
  })

  it('accepts a list of priorities', async () => {
    const result = await executeWorkflow(
      conditionWorkflow('task_priority', { priority: ['high', 'medium'], taskId: '${taskId}' }),
      { taskId: 'task-1', taskPriority: 'medium' }
    )

    expect(conditionResult(result.results)).toBe('true')
  })

  it('evaluates task_list', async () => {
    const result = await executeWorkflow(
      conditionWorkflow('task_list', { listId: 'work', taskId: '${taskId}' }),
      { taskId: 'task-1', taskListId: 'work' }
    )

    expect(conditionResult(result.results)).toBe('true')
  })

  it('requires every configured label to be present on task_labels', async () => {
    const matching = await executeWorkflow(
      conditionWorkflow('task_labels', { labels: ['urgent', 'client'], taskId: '${taskId}' }),
      { taskId: 'task-1', taskLabels: ['urgent', 'client', 'billing'] }
    )
    expect(conditionResult(matching.results)).toBe('true')

    const partial = await executeWorkflow(
      conditionWorkflow('task_labels', { labels: ['urgent', 'client'], taskId: '${taskId}' }),
      { taskId: 'task-1', taskLabels: ['urgent'] }
    )
    expect(conditionResult(partial.results)).toBe('false')
  })

  it('compares task_estimate with the configured operator', async () => {
    const cases: [string, number, boolean][] = [
      ['>', 30, true],
      ['>', 60, false],
      ['>=', 60, true],
      ['<=', 60, true],
      ['<', 60, false],
      ['=', 60, true],
      ['!=', 60, false],
    ]

    for (const [operator, value, expected] of cases) {
      const result = await executeWorkflow(
        conditionWorkflow('task_estimate', { operator, value, taskId: '${taskId}' }),
        { taskId: 'task-1', taskEstimate: 60 }
      )
      expect(conditionResult(result.results)).toBe(expected ? 'true' : 'false')
    }
  })

  it('reads the right task when the trigger supplies several', async () => {
    const result = await executeWorkflow(
      conditionWorkflow('task_priority', { priority: 'high', taskId: 'task-2' }),
      {
        tasks: [
          { id: 'task-1', taskPriority: 'low' },
          { id: 'task-2', taskPriority: 'high' },
        ],
      }
    )

    expect(conditionResult(result.results)).toBe('true')
  })

  it('never evaluates a custom condition as true', async () => {
    const result = await executeWorkflow(
      conditionWorkflow('custom', { script: 'return true' }),
      { taskId: 'task-1' }
    )

    expect(conditionResult(result.results)).toBe('false')
  })

  it('fails the branch when the trigger supplied no task data', async () => {
    const result = await executeWorkflow(
      conditionWorkflow('task_priority', { priority: 'high', taskId: '${taskId}' }),
      {}
    )

    expect(conditionResult(result.results)).toBe('false')
  })
})

describe('Workflow engine — branching', () => {
  it('only runs the action on the edge matching the branch taken', async () => {
    createTaskMock.mockClear()

    const workflow = workflowWith(
      [
        { id: 't', type: 'trigger', triggerType: 'task_completed', config: {}, position: { x: 0, y: 0 } },
        { id: 'c', type: 'condition', conditionType: 'task_priority', config: { priority: 'high', taskId: '${taskId}' }, position: { x: 100, y: 0 } },
        { id: 'a-yes', type: 'action', actionType: 'create_task', config: { taskData: { name: 'yes' } }, position: { x: 200, y: 0 } },
        { id: 'a-no', type: 'action', actionType: 'create_task', config: { taskData: { name: 'no' } }, position: { x: 200, y: 100 } },
      ],
      [
        { id: 'e1', source: 't', target: 'c' },
        { id: 'e2', source: 'c', target: 'a-yes', sourceHandle: 'true' },
        { id: 'e3', source: 'c', target: 'a-no', sourceHandle: 'false' },
      ]
    )

    const result = await executeWorkflow(workflow, { taskId: 'task-1', taskPriority: 'low' })

    const executed = result.results.map(r => r.nodeId)
    expect(executed).toContain('a-no')
    expect(executed).not.toContain('a-yes')
    expect(createTaskMock).toHaveBeenCalledTimes(1)
    expect(createTaskMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'no' }))
  })
})

describe('Workflow engine — webhook trigger', () => {
  /**
   * Sign a webhook payload exactly the way the engine expects:
   * HMAC-SHA256(secret, `${timestamp}.${JSON.stringify(payloadWithoutSignature)}`).
   */
  async function sign(secret: string, payload: Record<string, unknown>): Promise<string> {
    const timestamp = payload.timestamp as string
    const body: Record<string, unknown> = { ...payload }
    delete body.signature

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${JSON.stringify(body)}`))
    return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  function webhookWorkflow(secret?: string): Workflow {
    return workflowWith(
      [
        {
          id: 'trigger-1',
          type: 'trigger',
          triggerType: 'webhook',
          config: secret ? { secret } : {},
          position: { x: 0, y: 0 },
        },
      ],
      []
    )
  }

  it('refuses to run when no secret is configured', async () => {
    const result = await executeWorkflow(webhookWorkflow(), { event: 'ping' })

    expect(result.success).toBe(true) // the trigger node itself ran
    const node = result.results[0]
    expect(node.success).toBe(false)
    expect(node.error).toMatch(/no secret/i)
  })

  it('rejects a payload with no signature', async () => {
    const timestamp = new Date().toISOString()
    const result = await executeWorkflow(webhookWorkflow('s3cret'), { timestamp, event: 'ping' })

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toMatch(/signature or timestamp/i)
  })

  it('rejects an invalid signature', async () => {
    const timestamp = new Date().toISOString()
    const result = await executeWorkflow(webhookWorkflow('s3cret'), {
      timestamp,
      event: 'ping',
      signature: 'deadbeef',
    })

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toMatch(/invalid webhook signature/i)
  })

  it('rejects a signature made with the wrong secret', async () => {
    const payload = { timestamp: new Date().toISOString(), event: 'ping' }
    const signature = await sign('wrong-secret', payload)

    const result = await executeWorkflow(webhookWorkflow('s3cret'), { ...payload, signature })

    expect(result.results[0].success).toBe(false)
  })

  it('rejects a stale timestamp to block replay', async () => {
    const secret = 's3cret'
    const payload = {
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      event: 'ping',
    }
    const signature = await sign(secret, payload)

    const result = await executeWorkflow(webhookWorkflow(secret), { ...payload, signature })

    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toMatch(/tolerance/i)
  })

  it('accepts a correctly signed, fresh payload', async () => {
    const secret = 's3cret'
    const payload = { timestamp: new Date().toISOString(), event: 'ping', id: 'task-1' }
    const signature = await sign(secret, payload)

    const result = await executeWorkflow(webhookWorkflow(secret), { ...payload, signature })

    expect(result.results[0].success).toBe(true)
  })
})

describe('Workflow engine — structure', () => {
  it('fails a workflow that has no trigger node', async () => {
    const result = await executeWorkflow(
      workflowWith(
        [{ id: 'a', type: 'action', actionType: 'log_activity', config: {}, position: { x: 0, y: 0 } }],
        []
      )
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no trigger/i)
  })

  it('ships templates that are structurally valid', () => {
    expect(WORKFLOW_TEMPLATES.length).toBeGreaterThan(0)

    for (const template of WORKFLOW_TEMPLATES) {
      const nodeIds = new Set(template.nodes.map(n => n.id))
      expect(nodeIds.size).toBe(template.nodes.length) // ids unique

      for (const edge of template.edges) {
        expect(nodeIds.has(edge.source)).toBe(true)
        expect(nodeIds.has(edge.target)).toBe(true)
      }

      // Every workflow must have exactly one entry point.
      const targeted = new Set(template.edges.map(e => e.target))
      const roots = template.nodes.filter(n => !targeted.has(n.id))
      expect(roots.length).toBe(1)
      expect(roots[0].type).toBe('trigger')
    }
  })
})