import { NextResponse } from 'next/server'
import type { Workflow } from '@/lib/workflows/engine'

// In-memory storage for workflows (would be database in production)
const workflows: Workflow[] = []

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

export async function POST(request: Request) {
  try {
    const workflow = await request.json()
    const newWorkflow: Workflow = {
      ...workflow,
      id: workflow.id || `wf-${Date.now()}`,
      createdAt: workflow.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    workflows.push(newWorkflow)

    return NextResponse.json(newWorkflow, { status: 201 })
  } catch (error) {
    console.error('Failed to create workflow:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const workflow = await request.json()
    const index = workflows.findIndex(w => w.id === workflow.id)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const updatedWorkflow: Workflow = {
      ...workflow,
      updatedAt: Date.now(),
    }

    workflows[index] = updatedWorkflow

    return NextResponse.json(updatedWorkflow)
  } catch (error) {
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