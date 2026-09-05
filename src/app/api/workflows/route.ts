import { NextResponse } from 'next/server'
import type { Workflow } from '@/lib/workflows/engine'
import { workflows } from '@/lib/workflow-store'
import {
  parseJsonBody,
  validationErrorResponse,
  RequestValidationError,
} from '@/lib/validation'
import { z } from 'zod'

// Workflow management endpoints
export async function GET() {
  try {
    return NextResponse.json(workflows)
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'action', 'condition']),
  triggerType: z.any().optional(),
  actionType: z.any().optional(),
  conditionType: z.any().optional(),
  config: z.record(z.string(), z.any()).default({}),
  position: z.object({ x: z.number(), y: z.number() }),
})

const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
})

const workflowSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  enabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastRun: z.number().optional(),
  runCount: z.number(),
})

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, workflowSchema)

    const workflow: Workflow = {
      ...body,
      description: body.description ?? '',
      id: body.id || `wf-${Date.now()}`,
      createdAt: body.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    workflows.push(workflow)

    return NextResponse.json(workflow, { status: 201 })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error)
    }
    console.error('Failed to create workflow:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await parseJsonBody(request, workflowSchema)

    const index = workflows.findIndex(w => w.id === body.id)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const updatedWorkflow: Workflow = {
      ...body,
      description: body.description ?? '',
      updatedAt: Date.now(),
    }

    workflows[index] = updatedWorkflow

    return NextResponse.json(updatedWorkflow)
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error)
    }
    console.error('Failed to update workflow:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID required' },
        { status: 400 }
      )
    }

    const index = workflows.findIndex(w => w.id === id)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    workflows.splice(index, 1)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete workflow:', error)
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    )
  }
}
