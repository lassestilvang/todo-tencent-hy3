/**
 * Workflow Automation Engine
 * Visual workflow builder with triggers, actions, and conditions
 */

import type { Task } from '@/types'
import { createTask, updateTask } from '@/lib/tasks-client'

/**
 * Workflow trigger types
 */
export type TriggerType =
  | 'schedule'           // Time-based trigger
  | 'task_created'       // When a task is created
  | 'task_completed'     // When a task is completed
  | 'task_updated'       // When a task is updated
  | 'deadline_approaching' // Before task deadline
  | 'webhook'            // External webhook

/**
 * Workflow action types
 */
export type ActionType =
  | 'create_task'        // Create a new task
  | 'update_task'        // Update existing task
  | 'send_notification'  // Send notification
  | 'call_webhook'       // Call external webhook
  | 'send_email'         // Send email
  | 'create_list'        // Create a new list
  | 'add_label'          // Add label to task
  | 'set_priority'       // Set task priority
  | 'set_deadline'       // Set task deadline
  | 'log_activity'       // Log activity

/**
 * Condition types for branching
 */
export type ConditionType =
  | 'task_priority'      // Check task priority
  | 'task_list'          // Check task list
  | 'task_labels'        // Check task labels
  | 'time_of_day'        // Check current time
  | 'day_of_week'        // Check day of week
  | 'task_estimate'      // Check task estimate
  | 'custom'             // Custom JavaScript condition

/**
 * Workflow node interface
 */
export interface WorkflowNode {
  id: string
  type: 'trigger' | 'action' | 'condition'
  triggerType?: TriggerType
  actionType?: ActionType
  conditionType?: ConditionType
  config: Record<string, unknown>
  position: { x: number; y: number }
}

/**
 * Workflow edge (connection between nodes)
 */
export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/**
 * Complete workflow definition
 */
export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  enabled: boolean
  createdAt: number
  updatedAt: number
  lastRun?: number
  runCount: number
}

/**
 * Execution context for workflow runs
 */
interface ExecutionContext {
  workflowId: string
  triggerData: Record<string, unknown>
  variables: Map<string, unknown>
  completedActions: Map<string, unknown>
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(
  workflow: Workflow,
  triggerData: Record<string, unknown> = {}
): Promise<{ success: boolean; results: WorkflowResult[]; error?: string }> {
  const results: WorkflowResult[] = []
  const context: ExecutionContext = {
    workflowId: workflow.id,
    triggerData,
    variables: new Map(),
    completedActions: new Map(),
  }

  try {
    // Find trigger nodes
    const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger')

    if (triggerNodes.length === 0) {
      return { success: false, results, error: 'No trigger nodes found' }
    }

    // Execute from each trigger
    for (const triggerNode of triggerNodes) {
      await executeNode(workflow, triggerNode, context, results)
    }

    // Update workflow run count
    // In a real implementation, this would persist to database

    return { success: true, results }
  } catch (error) {
    console.error('Workflow execution error:', error)
    return {
      success: false,
      results,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Execute a single node and its downstream nodes
 */
async function executeNode(
  workflow: Workflow,
  node: WorkflowNode,
  context: ExecutionContext,
  results: WorkflowResult[]
): Promise<void> {
  // Skip if already executed
  if (context.completedActions.has(node.id)) return

  let result: WorkflowResult

  switch (node.type) {
    case 'trigger':
      result = await executeTrigger(node, context)
      break
    case 'action':
      result = await executeAction(node, context)
      break
    case 'condition':
      result = await executeCondition(node, context)
      break
    default:
      result = { nodeId: node.id, success: false, error: 'Unknown node type' }
  }

  results.push(result)
  context.completedActions.set(node.id, result)

  if (!result.success) return

  // Find connected edges and execute downstream nodes
  const outgoingEdges = workflow.edges.filter(e => e.source === node.id)

  for (const edge of outgoingEdges) {
    const targetNode = workflow.nodes.find(n => n.id === edge.target)
    if (targetNode) {
      // For conditions, check if we should follow this branch
      if (node.type === 'condition' && edge.sourceHandle) {
        const conditionResult = context.completedActions.get(node.id) as WorkflowResult
        const shouldFollow = edge.sourceHandle === (conditionResult.data?.branch as string)
        if (!shouldFollow) continue
      }
      await executeNode(workflow, targetNode, context, results)
    }
  }
}

/**
 * Execute a trigger node
 */
async function executeTrigger(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<WorkflowResult> {
  const triggerType = node.triggerType

  switch (triggerType) {
    case 'schedule': {
      // Schedule triggers are handled by external scheduler
      // This node just passes trigger data
      const schedule = node.config.schedule as string
      const data = context.triggerData

      return {
        nodeId: node.id,
        success: true,
        data: { triggered: true, schedule, ...data },
      }
    }

    case 'task_created':
    case 'task_completed':
    case 'task_updated':
    case 'deadline_approaching': {
      // These are event-driven triggers
      // The trigger data contains the task info
      return {
        nodeId: node.id,
        success: true,
        data: { triggered: true, event: triggerType, ...context.triggerData },
      }
    }

    case 'webhook': {
      const secret = node.config.secret as string | undefined
      const payload = context.triggerData

      // A webhook trigger runs arbitrary actions, so an unverified payload
      // must never be accepted. If no secret is configured the trigger can
      // never fire — fail closed rather than open.
      if (!secret) {
        return {
          nodeId: node.id,
          success: false,
          error: 'Webhook trigger has no secret configured; refusing to run',
        }
      }

      const signature = context.triggerData.signature as string | undefined
      const timestamp = context.triggerData.timestamp as string | undefined

      if (!signature || !timestamp) {
        return {
          nodeId: node.id,
          success: false,
          error: 'Webhook payload is missing signature or timestamp',
        }
      }

      // Reject replays of stale payloads.
      const ageMs = Date.now() - new Date(timestamp).getTime()
      if (!Number.isFinite(ageMs) || ageMs > WEBHOOK_TOLERANCE_MS) {
        return { nodeId: node.id, success: false, error: 'Webhook timestamp is outside tolerance' }
      }

      const valid = await verifyWebhookSignature(secret, timestamp, payload, signature)
      if (!valid) {
        return { nodeId: node.id, success: false, error: 'Invalid webhook signature' }
      }

      return {
        nodeId: node.id,
        success: true,
        data: { triggered: true, payload },
      }
    }

    default:
      return { nodeId: node.id, success: false, error: 'Unknown trigger type' }
  }
}

/**
 * Execute an action node
 */
async function executeAction(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<WorkflowResult> {
  const actionType = node.actionType
  const config = node.config

  try {
    switch (actionType) {
      case 'create_task': {
        const taskData = config.taskData as Partial<Task>
        // Resolve variables in task data
        const resolvedData = resolveVariables(taskData, context)

        const task = await createTask(resolvedData)
        return {
          nodeId: node.id,
          success: true,
          data: { task, taskId: task.id },
        }
      }

      case 'update_task': {
        const taskId = resolveVariable(config.taskId as string, context) as string
        const updates = config.updates as Partial<Task>

        await updateTask(taskId, resolveVariables(updates, context))
        return {
          nodeId: node.id,
          success: true,
          data: { taskId, updated: true },
        }
      }

      case 'send_notification': {
        const title = resolveVariable(config.title as string, context) as string
        const body = resolveVariable(config.body as string, context) as string

        // In real implementation, send push notification
        console.log('Notification:', title, body)

        return {
          nodeId: node.id,
          success: true,
          data: { sent: true },
        }
      }

      case 'call_webhook': {
        const url = resolveVariable(config.url as string, context) as string
        const method = (config.method as string) || 'POST'
        const headers = config.headers as Record<string, string> || {}
        const body = config.body ? resolveVariables(config.body as Record<string, unknown>, context) : {}

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(body),
        })

        return {
          nodeId: node.id,
          success: response.ok,
          data: { status: response.status },
          error: response.ok ? undefined : `HTTP ${response.status}`,
        }
      }

      case 'add_label': {
        const taskId = resolveVariable(config.taskId as string, context) as string
        const labelId = resolveVariable(config.labelId as string, context) as string

        // In real implementation, call addTaskLabel
        console.log('Add label:', labelId, 'to task:', taskId)

        return {
          nodeId: node.id,
          success: true,
          data: { taskId, labelId },
        }
      }

      case 'set_priority': {
        const taskId = resolveVariable(config.taskId as string, context) as string
        const priority = resolveVariable(config.priority as string, context) as 'high' | 'medium' | 'low' | 'none'

        await updateTask(taskId, { priority })
        return {
          nodeId: node.id,
          success: true,
          data: { taskId, priority },
        }
      }

      case 'set_deadline': {
        const taskId = resolveVariable(config.taskId as string, context) as string
        const deadline = resolveVariable(config.deadline as string, context) as string

        await updateTask(taskId, { deadline })
        return {
          nodeId: node.id,
          success: true,
          data: { taskId, deadline },
        }
      }

      case 'log_activity': {
        const message = resolveVariable(config.message as string, context) as string
        console.log('Workflow log:', message)

        return {
          nodeId: node.id,
          success: true,
          data: { logged: true, message },
        }
      }

      default:
        return { nodeId: node.id, success: false, error: 'Unknown action type' }
    }
  } catch (error) {
    return {
      nodeId: node.id,
      success: false,
      error: error instanceof Error ? error.message : 'Action execution failed',
    }
  }
}

/**
 * How old a webhook payload may be before it is rejected as a replay.
 */
const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000

/**
 * Verify an HMAC-SHA256 webhook signature.
 *
 * Signing contract for webhook senders:
 *   message  = `${timestamp}.${JSON.stringify(payloadWithoutSignature)}`
 *   signature = hex(HMAC-SHA256(secret, message))   (a `sha256=` prefix is allowed)
 *
 * `payloadWithoutSignature` is the full received payload with only the
 * `signature` key removed — `timestamp` stays in it. Keys must be sent in the
 * same order they are signed in, since the message is built with JSON.stringify.
 *
 * Uses Web Crypto so it works in both the browser and Node 18+. Comparison is
 * constant-time-ish via a full-length XOR accumulate over equal-length digests.
 */
async function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  payload: Record<string, unknown>,
  signature: string
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { ...payload }
    delete body.signature
    const message = `${timestamp}.${JSON.stringify(body)}`

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    const expected = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const provided = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature

    if (provided.length !== expected.length) return false

    let diff = 0
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
    }
    return diff === 0
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return false
  }
}

/**
 * Read a task field for a condition to test against.
 *
 * The engine has no database access, so conditions evaluate against the data
 * the trigger supplied. `taskIdConfig` may contain a `${taskId}` reference; the
 * value it resolves to selects which triggered task's fields to read.
 */
function triggerValue(
  context: ExecutionContext,
  taskIdConfig: string | undefined,
  field: string
): unknown {
  const trigger = context.triggerData

  // If several tasks were triggered at once, narrow to the referenced one.
  if (taskIdConfig) {
    const resolved = resolveVariable(taskIdConfig, context)
    if (typeof resolved === 'string' && resolved.startsWith('${')) {
      return undefined // Unresolved reference — nothing to compare against
    }

    const tasks = trigger.tasks
    if (Array.isArray(tasks) && resolved) {
      const match = tasks.find(
        (t: Record<string, unknown>) => t?.id === resolved
      ) as Record<string, unknown> | undefined
      if (match) return match[field]
    }

    // Single-task trigger: fall through to the flat trigger shape.
    if (trigger.id === resolved && trigger[field] !== undefined) {
      return trigger[field]
    }
    // Trigger supplied no task payload at all.
    if (trigger.tasks === undefined && trigger[field] !== undefined) {
      return trigger[field]
    }
  }

  return trigger[field]
}

/**
 * Execute a condition node
 */
async function executeCondition(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<WorkflowResult> {
  const conditionType = node.conditionType
  const config = node.config

  try {
    let result: boolean

    switch (conditionType) {
      case 'task_priority': {
        const expected = config.priority as string | undefined
        const actual = triggerValue(context, config.taskId as string | undefined, 'taskPriority')
        if (!expected) {
          result = false
          break
        }
        // Accept a single priority or a list of acceptable priorities.
        const accepted = Array.isArray(expected) ? (expected as string[]) : [expected]
        result = typeof actual === 'string' && accepted.includes(actual)
        break
      }

      case 'task_list': {
        const expected = config.listId as string | undefined
        const actual = triggerValue(context, config.taskId as string | undefined, 'taskListId')
        result = Boolean(expected) && actual === expected
        break
      }

      case 'task_labels': {
        const expected = config.labels as string[] | undefined
        const actual = triggerValue(context, config.taskId as string | undefined, 'taskLabels')
        if (!expected || expected.length === 0 || !Array.isArray(actual)) {
          result = false
          break
        }
        // True when the task carries every label the condition requires.
        result = expected.every(label => (actual as string[]).includes(label))
        break
      }

      case 'time_of_day': {
        const hour = new Date().getHours()
        const startHour = config.startHour as number
        const endHour = config.endHour as number
        result = hour >= startHour && hour < endHour
        break
      }

      case 'day_of_week': {
        const day = new Date().getDay()
        const expectedDays = config.days as number[]
        result = expectedDays.includes(day)
        break
      }

      case 'task_estimate': {
        const operator = (config.operator as '>' | '>=' | '<' | '<=' | '=' | '!=') || '>'
        const value = config.value as number
        const actual = triggerValue(context, config.taskId as string | undefined, 'taskEstimate')
        const estimate = typeof actual === 'number' ? actual : Number(actual)

        if (value === undefined || Number.isNaN(estimate)) {
          result = false
          break
        }

        switch (operator) {
          case '>': result = estimate > value; break
          case '>=': result = estimate >= value; break
          case '<': result = estimate < value; break
          case '<=': result = estimate <= value; break
          case '=': result = estimate === value; break
          case '!=': result = estimate !== value; break
          default: result = false
        }
        break
      }

      case 'custom': {
        // Custom conditions are intentionally not evaluated: running
        // user-supplied code here would be a code-execution hole. A
        // condition with no executable expression evaluates to false so the
        // false-branch is taken rather than silently running every action.
        console.warn(
          `Workflow condition ${node.id} uses an unsupported 'custom' condition and evaluated to false`
        )
        result = false
        break
      }

      default:
        result = false
    }

    // Return branch indicator for edge routing
    return {
      nodeId: node.id,
      success: true,
      data: { branch: result ? 'true' : 'false', result },
    }
  } catch (error) {
    return {
      nodeId: node.id,
      success: false,
      error: error instanceof Error ? error.message : 'Condition evaluation failed',
    }
  }
}

/**
 * Resolve variables in a configuration object
 */
function resolveVariables<T extends Record<string, unknown>>(
  obj: T,
  context: ExecutionContext
): T {
  const result = { ...obj } as T

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = resolveVariable(value, context)
    } else if (typeof value === 'object' && value !== null) {
      (result as Record<string, unknown>)[key] = resolveVariables(value as Record<string, unknown>, context)
    }
  }

  return result
}

/**
 * Resolve a single variable string
 * Supports ${variable} syntax
 */
function resolveVariable(str: string, context: ExecutionContext): unknown {
  const variableRegex = /\$\{([^}]+)\}/g

  return str.replace(variableRegex, (match, varName) => {
    // Check trigger data
    if (context.triggerData[varName] !== undefined) {
      return String(context.triggerData[varName])
    }

    // Check variables map
    if (context.variables.has(varName)) {
      return String(context.variables.get(varName))
    }

    // Check completed actions
    if (context.completedActions.has(varName)) {
      const actionResult = context.completedActions.get(varName) as WorkflowResult
      if (actionResult.data) {
        return JSON.stringify(actionResult.data)
      }
    }

    return match // Return original if not found
  })
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  nodeId: string
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/**
 * Workflow template definitions
 */
export const WORKFLOW_TEMPLATES: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'lastRun'>[] = [
  {
    name: 'Daily Review Reminder',
    description: 'Create a daily review task every weekday at 5 PM',
    enabled: true,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        triggerType: 'schedule',
        config: { schedule: '0 17 * * 1-5' }, // 5 PM weekdays
        position: { x: 100, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        actionType: 'create_task',
        config: {
          taskData: {
            name: 'Daily Review',
            description: 'Review today\'s accomplishments and plan tomorrow',
            priority: 'high',
            estimate: 15,
            tags: ['daily', 'review'],
          },
        },
        position: { x: 300, y: 100 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
    ],
  },
  {
    name: 'Overdue Task Escalation',
    description: 'Escalate overdue high-priority tasks',
    enabled: true,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        triggerType: 'schedule',
        config: { schedule: '0 9 * * *' }, // 9 AM daily
        position: { x: 100, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        actionType: 'call_webhook',
        config: {
          url: '${WEBHOOK_URL}/overdue-check',
          method: 'POST',
        },
        position: { x: 300, y: 100 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
    ],
  },
  {
    name: 'Task Completion Follow-up',
    description: 'Create follow-up task when high-priority task is completed',
    enabled: true,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        triggerType: 'task_completed',
        config: {},
        position: { x: 100, y: 100 },
      },
      {
        id: 'condition-1',
        type: 'condition',
        conditionType: 'task_priority',
        config: { priority: 'high', taskId: '${taskId}' },
        position: { x: 300, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        actionType: 'create_task',
        config: {
          taskData: {
            name: 'Follow-up: ${taskName}',
            description: 'Follow-up work for completed task: ${taskName}',
            priority: 'medium',
            estimate: 30,
            parent_task_id: '${taskId}',
          },
        },
        position: { x: 500, y: 50 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'condition-1' },
      { id: 'edge-2', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
    ],
  },
]