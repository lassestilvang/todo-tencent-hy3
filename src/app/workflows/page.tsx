'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { WorkflowBuilder } from '@/components/workflows/workflow-builder'
import type { Workflow } from '@/lib/workflows/engine'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadWorkflows() {
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
    }

    loadWorkflows()
  }, [])

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
          onClick={() => setShowBuilder(true)}
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
                </div>
              </CardContent>

              <div className="p-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const idx = workflows.findIndex(wf => wf.id === w.id)
                    if (idx > -1) {
                      workflows.splice(idx, 1)
                      setWorkflows([...workflows])
                    }
                  }}
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
                Workflow Builder
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
                onWorkflowSaved={(workflow) => {
                  setWorkflows([...workflows, workflow])
                  setShowBuilder(false)
                  toast.success('Workflow saved')
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}