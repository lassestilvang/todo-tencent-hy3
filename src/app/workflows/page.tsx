'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { WorkflowBuilder } from '@/components/workflows/workflow-builder'
import type { Workflow } from '@/lib/workflows/engine'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)

  const loadWorkflows = useCallback(async () => {
    try {
      const result = await fetch('/api/workflows')
      if (!result.ok) throw new Error('Failed to fetch')
      const data = await result.json()
      setWorkflows(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load workflows:', err)
      toast.error('Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  const handleSaveWorkflow = useCallback(async (workflow: Workflow) => {
    try {
      const isNew = !workflows.some(w => w.id === workflow.id)
      const res = await fetch('/api/workflows', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
      })
      if (!res.ok) throw new Error('Failed to save')

      if (isNew) {
        setWorkflows([...workflows, workflow])
      } else {
        setWorkflows(workflows.map(w => w.id === workflow.id ? workflow : w))
      }
      setShowBuilder(false)
      setEditingWorkflow(null)
      toast.success(`Workflow ${isNew ? 'created' : 'updated'} successfully`)
    } catch (err) {
      console.error('Failed to save workflow:', err)
      toast.error('Failed to save workflow')
    }
  }, [workflows])

  const handleDeleteWorkflow = useCallback(async (w: Workflow) => {
    if (!confirm(`Delete workflow "${w.name}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/workflows?id=${w.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      setWorkflows(workflows.filter(wf => wf.id !== w.id))
      toast.success('Workflow deleted')
    } catch (err) {
      console.error('Failed to delete workflow:', err)
      toast.error('Failed to delete workflow')
    }
  }, [workflows])

  const handleExecuteWorkflow = useCallback(async (w: Workflow) => {
    try {
      const res = await fetch(`/api/workflows/${w.id}/execute`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to execute')

      const result = await res.json()
      if (result.success) {
        toast.success(`Workflow executed — ${result.results?.length || 0} steps completed`)
        // Refresh to pick up updated runCount/lastRun
        loadWorkflows()
      } else {
        toast.error(`Workflow failed: ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      console.error('Failed to execute workflow:', err)
      toast.error('Failed to execute workflow')
    }
  }, [loadWorkflows])

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Workflows</h1>

        <Button
          variant="default"
          size="sm"
          onClick={() => {
            setEditingWorkflow(null)
            setShowBuilder(true)
          }}
        >
          New Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No workflows yet. Click &ldquo;New Workflow&rdquo; to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((w) => (
            <Card key={w.id} className="h-full border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {w.enabled && (
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                  )}
                  {w.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm">
                <div className="text-ellipsis line-clamp-2">
                  {w.description || 'No description'}
                </div>

                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <div>Nodes: {w.nodes.length}</div>
                  <div>Edges: {w.edges.length}</div>
                  {w.lastRun && (
                    <div>Last run: {new Date(w.lastRun).toLocaleString()}</div>
                  )}
                  {w.runCount > 0 && (
                    <div>Runs: {w.runCount}</div>
                  )}
                </div>
              </CardContent>

              <div className="p-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingWorkflow(w)
                    setShowBuilder(true)
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant={w.enabled ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => handleExecuteWorkflow(w)}
                  disabled={!w.enabled}
                >
                  Run
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteWorkflow(w)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Builder panel */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Workflow Builder: {editingWorkflow ? 'Edit' : 'New'}
                <button
                  onClick={() => setShowBuilder(false)}
                  className="ml-auto p-1 rounded-md hover:bg-muted"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowBuilder
                workflow={editingWorkflow ?? undefined}
                onWorkflowSaved={handleSaveWorkflow}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}