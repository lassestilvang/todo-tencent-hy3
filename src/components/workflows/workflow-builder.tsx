'use client'

import { useState, useCallback } from 'react'
import {
  Brain,
  Calendar,
  Zap,
  X,
  Plus,
  Trash2,
  Play,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  executeWorkflow,
  WORKFLOW_TEMPLATES,
  type Workflow,
  type WorkflowNode,
  type WorkflowEdge,
  type TriggerType,
  type ActionType,
  type ConditionType,
} from '@/lib/workflows/engine'

interface WorkflowBuilderProps {
  workflowId?: string
  onWorkflowSaved?: (workflow: Workflow) => void
}

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'deadline_approaching', label: 'Deadline Approaching' },
  { value: 'webhook', label: 'Webhook' },
]

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'create_task', label: 'Create Task' },
  { value: 'update_task', label: 'Update Task' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'call_webhook', label: 'Call Webhook' },
  { value: 'send_connector_message', label: 'Send via Connector' },
  { value: 'add_label', label: 'Add Label' },
  { value: 'set_priority', label: 'Set Priority' },
  { value: 'set_deadline', label: 'Set Deadline' },
]

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: 'task_priority', label: 'Task Priority' },
  { value: 'task_list', label: 'Task List' },
  { value: 'task_labels', label: 'Task Labels' },
  { value: 'time_of_day', label: 'Time of Day' },
  { value: 'day_of_week', label: 'Day of Week' },
  { value: 'task_estimate', label: 'Task Estimate' },
  { value: 'custom', label: 'Custom' },
]

const INITIAL_TEMPLATE = WORKFLOW_TEMPLATES[0]

function toNodeMap(template: typeof WORKFLOW_TEMPLATES[0]): Map<string, WorkflowNode> {
  return new Map(template.nodes.map(node => [node.id, { ...node }]))
}

function toEdgeMap(template: typeof WORKFLOW_TEMPLATES[0]): Map<string, WorkflowEdge> {
  return new Map(template.edges.map(edge => [edge.id, { ...edge }]))
}

export function WorkflowBuilder({ workflowId: _workflowId, onWorkflowSaved }: WorkflowBuilderProps) {
  // Seeded from the template directly so no effect-driven setState cascade.
  const [nodes, setNodes] = useState<Map<string, WorkflowNode>>(() => toNodeMap(INITIAL_TEMPLATE))
  const [edges, setEdges] = useState<Map<string, WorkflowEdge>>(() => toEdgeMap(INITIAL_TEMPLATE))
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan] = useState({ x: 0, y: 0 })

  const setupTemplate = useCallback((template: typeof WORKFLOW_TEMPLATES[0]) => {
    setNodes(toNodeMap(template))
    setEdges(toEdgeMap(template))
  }, [])

  // Add trigger node
  const addTrigger = useCallback((triggerType: TriggerType) => {
    const id = `trigger-${Date.now()}`
    const node: WorkflowNode = {
      id,
      type: 'trigger',
      triggerType,
      config: { schedule: '0 9 * * 1-5' },
      position: { x: 100 + nodes.size * 200, y: 100 },
    }

    setNodes(prev => new Map(prev).set(id, node))
  }, [nodes])

  // Add action node
  const addAction = useCallback((actionType: ActionType) => {
    const id = `action-${Date.now()}`
    const node: WorkflowNode = {
      id,
      type: 'action',
      actionType,
      config: { taskData: {} },
      position: { x: 300 + nodes.size * 200, y: 100 },
    }

    setNodes(prev => new Map(prev).set(id, node))
  }, [nodes])

  // Add condition node
  const addCondition = useCallback((conditionType: ConditionType) => {
    const id = `condition-${Date.now()}`
    const node: WorkflowNode = {
      id,
      type: 'condition',
      conditionType,
      config: {},
      position: { x: 500 + nodes.size * 200, y: 100 },
    }

    setNodes(prev => new Map(prev).set(id, node))
  }, [nodes])

  // Remove node
  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const next = new Map(prev)
      next.delete(nodeId)
      return next
    })

    setEdges(prev => {
      const next = new Map(prev)
      prev.forEach((edge, key) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          next.delete(key)
        }
      })
      return next
    })

    if (selectedNode === nodeId) {
      setSelectedNode(null)
    }
  }, [selectedNode])

  // Connect nodes
  const connectNodes = useCallback((from: string, to: string) => {
    const id = `edge-${Date.now()}`
    setEdges(prev => new Map(prev).set(id, {
      id,
      source: from,
      target: to,
      sourceHandle: 'output',
    }))

    setIsConnecting(false)
    setConnectingFrom(null)
  }, [])

  // Execute workflow
  const executeWorkflowFn = useCallback(async () => {
    const workflow: Workflow = {
      id: `wf-${Date.now()}`,
      name: 'New Workflow',
      description: '',
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastRun: undefined,
      runCount: 0,
    }

    const result = await executeWorkflow(workflow)
    if (result.success) {
      toast.success('Workflow executed successfully')
      onWorkflowSaved?.(workflow)
    } else {
      toast.error(result.error || 'Workflow execution failed')
    }
  }, [nodes, edges, onWorkflowSaved])

  // Save workflow
  const saveWorkflow = useCallback(() => {
    const workflow: Workflow = {
      id: `wf-${Date.now()}`,
      name: 'New Workflow',
      description: '',
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastRun: undefined,
      runCount: 0,
    }

    onWorkflowSaved?.(workflow)
    toast.success('Workflow saved')
  }, [nodes, edges, onWorkflowSaved])

  const selectedNodeData = selectedNode ? nodes.get(selectedNode) : null

  return (
    <div className="h-full w-full">
      {/* Toolbar */}
      <div className="p-4 border-b bg-muted/50 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={executeWorkflowFn}>
            <Play className="h-4 w-4 mr-1" /> Execute
          </Button>
          <Button variant="secondary" size="sm" onClick={saveWorkflow}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>

          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Template</span>
            <select
              value=""
              onChange={(e) => {
                const template = WORKFLOW_TEMPLATES.find(t => t.name === e.target.value)
                if (template) {
                  setupTemplate(template)
                  setSelectedNode(null)
                  toast.success(`Loaded "${template.name}" template`)
                }
              }}
              className="px-3 py-2 border rounded bg-background"
            >
              <option value="">Start from template…</option>
              {WORKFLOW_TEMPLATES.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Node palette */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-4 max-h-[300px] overflow-y-auto">
          {TRIGGER_TYPES.map((t) => (
            <div
              key={t.value}
              className="p-3 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors text-sm"
              onClick={() => addTrigger(t.value)}
            >
              <Calendar className="h-4 w-4 mb-1" />
              {t.label}
            </div>
          ))}
          {ACTION_TYPES.map((t) => (
            <div
              key={t.value}
              className="p-3 rounded-lg bg-green-100 border border-green-200 cursor-pointer hover:bg-green-200 transition-colors text-sm"
              onClick={() => addAction(t.value)}
            >
              <Zap className="h-4 w-4 mb-1" />
              {t.label}
            </div>
          ))}
          {CONDITION_TYPES.map((t) => (
            <div
              key={t.value}
              className="p-3 rounded-lg bg-purple-100 border border-purple-200 cursor-pointer hover:bg-purple-200 transition-colors text-sm"
              onClick={() => addCondition(t.value)}
            >
              <Brain className="h-4 w-4 mb-1" />
              {t.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Workspace */}
        <div className="relative flex-1 h-[calc(100vh-160px)] overflow-auto">
          <div
            className="relative min-w-[800px] min-h-[600px]"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            onWheel={(e) => {
              e.preventDefault()
              const delta = e.deltaY > 0 ? 0.9 : 1.1
              setZoom(z => Math.max(0.5, Math.min(3, z * delta)))
            }}
          >
            {/* Edges */}
            {Array.from(edges.values()).map((edge) => {
              const sourceNode = nodes.get(edge.source)
              const targetNode = nodes.get(edge.target)

              if (!sourceNode || !targetNode) return null

              const sx = sourceNode.position.x + 20
              const sy = sourceNode.position.y + 20
              const tx = targetNode.position.x + 20
              const ty = targetNode.position.y + 20

              return (
                <svg key={edge.id} className="absolute inset-0 w-full h-full pointer-events-none">
                  <line
                    x1={sx}
                    y1={sy}
                    x2={tx}
                    y2={ty}
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeOpacity={0.5}
                  />
                </svg>
              )
            })}

            {/* Nodes */}
            {Array.from(nodes.values()).map((node) => {
              const isSelected = selectedNode === node.id

              return (
                <div
                  key={node.id}
                  className={cn(
                    'absolute p-4 rounded-lg cursor-move min-w-[180px] z-10',
                    isSelected && 'border-primary/50 bg-primary/5',
                    node.type === 'trigger' && 'bg-indigo-50 border-indigo-200',
                    node.type === 'action' && 'bg-green-50 border-green-200',
                    node.type === 'condition' && 'bg-purple-50 border-purple-200'
                  )}
                  style={{ left: node.position.x, top: node.position.y }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isConnecting && connectingFrom && connectingFrom !== node.id) {
                      connectNodes(connectingFrom, node.id)
                    } else {
                      setSelectedNode(node.id)
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (isConnecting && connectingFrom === node.id) {
                      setIsConnecting(false)
                      setConnectingFrom(null)
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {node.type === 'trigger' && <Calendar className="h-3 w-3" />}
                      {node.type === 'action' && <Zap className="h-3 w-3" />}
                      {node.type === 'condition' && <Brain className="h-3 w-3" />}
                      <span className="text-sm font-medium truncate">
                        {node.type === 'trigger' && TRIGGER_TYPES.find(t => t.value === node.triggerType)?.label ||
                         node.type === 'action' && ACTION_TYPES.find(t => t.value === node.actionType)?.label ||
                         node.type === 'condition' && CONDITION_TYPES.find(t => t.value === node.conditionType)?.label ||
                         node.id}
                      </span>
                    </div>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeNode(node.id)
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground/70 mt-1">
                    {(node.config.name as string) || node.id.split('-')[0]}
                  </div>
                </div>
              )
            })}

            {/* Connection hint */}
            {isConnecting && (
              <div
                className="absolute inset-0 flex items-center justify-center text-primary text-sm bg-primary/5 z-0 cursor-pointer"
                onClick={() => {
                  setIsConnecting(false)
                  setConnectingFrom(null)
                }}
              >
                <Plus className="h-8 w-8 mr-2" />
                <span>Click a target node to connect</span>
              </div>
            )}
          </div>
        </div>

        {/* Right panel - node properties */}
        <div className="w-72 p-4 bg-muted/50 border-l overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle>Node Properties</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNodeData ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Type</h4>
                    <select
                      defaultValue={selectedNodeData.type}
                      className="w-full px-3 py-2 border rounded bg-background"
                    >
                      <option value="trigger">Trigger</option>
                      <option value="action">Action</option>
                      <option value="condition">Condition</option>
                    </select>
                  </div>

                  {selectedNodeData.type === 'trigger' && (
                    <>
                      <div>
                        <h4 className="font-medium mb-2">Trigger Type</h4>
                        <select className="w-full px-3 py-2 border rounded bg-background">
                          {TRIGGER_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Schedule</h4>
                        <input
                          type="text"
                          defaultValue="0 9 * * 1-5"
                          className="w-full px-3 py-2 border rounded bg-background"
                        />
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'action' && (
                    <>
                      <div>
                        <h4 className="font-medium mb-2">Action Type</h4>
                        <select className="w-full px-3 py-2 border rounded bg-background">
                          {ACTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Task Data</h4>
                        <textarea
                          rows={4}
                          className="w-full px-3 py-2 border rounded bg-background resize-y"
                          placeholder="{'name': 'New Task', 'priority': 'high'}"
                        />
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'condition' && (
                    <>
                      <div>
                        <h4 className="font-medium mb-2">Condition Type</h4>
                        <select className="w-full px-3 py-2 border rounded bg-background">
                          {CONDITION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Condition Config</h4>
                        <textarea
                          rows={4}
                          className="w-full px-3 py-2 border rounded bg-background resize-y"
                          placeholder="{'priority': 'high'}"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeNode(selectedNodeData.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => saveWorkflow()}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select a node to view its properties
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}