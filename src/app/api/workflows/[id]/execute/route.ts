import { NextResponse } from 'next/server'
import { executeWorkflow } from '@/lib/workflows/engine'
import { workflows } from '@/lib/workflow-store'

/**
 * Execute a workflow by ID.
 *
 * POST /api/workflows/:id/execute
 *
 * Runs the workflow and returns the per-node results. The store is
 * updated with the new runCount and lastRun timestamp.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workflow = workflows.find(w => w.id === id)

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    if (!workflow.enabled) {
      return NextResponse.json(
        { error: 'Workflow is disabled' },
        { status: 400 }
      )
    }

    const result = await executeWorkflow(workflow)

    // Update run metadata
    workflow.lastRun = Date.now()
    workflow.runCount++

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to execute workflow:', error)
    return NextResponse.json(
      { error: 'Failed to execute workflow' },
      { status: 500 }
    )
  }
}
