'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Eye, EyeOff, Copy, Check, AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Webhook, WebhookEvent, generateWebhookSecret } from '@/lib/webhooks'

const ALL_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: 'task.created', label: 'Task Created', description: 'When a new task is created' },
  { value: 'task.updated', label: 'Task Updated', description: 'When a task is modified' },
  { value: 'task.completed', label: 'Task Completed', description: 'When a task is marked complete' },
  { value: 'task.deleted', label: 'Task Deleted', description: 'When a task is deleted' },
  { value: 'list.created', label: 'List Created', description: 'When a new list is created' },
  { value: 'list.updated', label: 'List Updated', description: 'When a list is modified' },
  { value: 'list.deleted', label: 'List Deleted', description: 'When a list is deleted' },
]

export function WebhookSettings() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([])
  const [secret, setSecret] = useState('')
  const [active, setActive] = useState(true)
  const [showSecret, setShowSecret] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadWebhooks()
  }, [])

  const loadWebhooks = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/webhooks')
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.webhooks || [])
      }
    } catch (error) {
      console.error('Failed to load webhooks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setName('')
    setUrl('')
    setSelectedEvents([])
    setSecret('')
    setActive(true)
    setShowSecret(false)
  }

  const openCreateDialog = () => {
    resetForm()
    setSecret(generateWebhookSecret())
    setShowCreateDialog(true)
  }

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook)
    setName(webhook.name)
    setUrl(webhook.url)
    setSelectedEvents(webhook.events)
    setSecret(webhook.secret)
    setActive(webhook.active)
    setShowSecret(false)
    setShowCreateDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingWebhook) {
        const res = await fetch(`/api/webhooks/${editingWebhook.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, url, events: selectedEvents, active }),
        })
        if (!res.ok) throw new Error('Failed to update webhook')
        toast.success('Webhook updated')
      } else {
        const res = await fetch('/api/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, url, events: selectedEvents, secret: secret || undefined }),
        })
        if (!res.ok) throw new Error('Failed to create webhook')
        toast.success('Webhook created')
      }
      setShowCreateDialog(false)
      setEditingWebhook(null)
      loadWebhooks()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this webhook? This cannot be undone.')) {
      try {
        const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete webhook')
        toast.success('Webhook deleted')
        loadWebhooks()
      } catch (error) {
        toast.error('Failed to delete webhook')
      }
    }
  }

  const handleRegenerateSecret = () => {
    setSecret(generateWebhookSecret())
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    toast.success('Secret copied!')
  }

  const copyUrl = (webhookUrl: string) => {
    navigator.clipboard.writeText(webhookUrl)
    toast.success('URL copied!')
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatLastTriggered = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - timestamp
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Webhooks
          </CardTitle>
          <CardDescription>
            Configure outgoing webhooks for task and list events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Webhooks
          </CardTitle>
          <CardDescription>
            Configure outgoing webhooks for task and list events. Integrate with Zapier, n8n, Make, or custom services.
          </CardDescription>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
              <DialogDescription>
                Configure a webhook to receive real-time events from TaskFlow
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-name">Name</Label>
                <Input
                  id="webhook-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Zapier Integration"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-service.com/webhook"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Must be a valid HTTPS URL
                </p>
              </div>

              <div className="space-y-2">
                <Label>Events to Subscribe</Label>
                <div className="space-y-1 max-h-60 overflow-y-auto border rounded-lg p-2">
                  {ALL_EVENTS.map(event => (
                    <label
                      key={event.value}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.value)}
                        onChange={(e) =>
                          e.target.checked
                            ? setSelectedEvents([...selectedEvents, event.value])
                            : setSelectedEvents(selectedEvents.filter(e => e !== event.value))
                        }
                        className="text-primary"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Secret (for signature verification)</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook-secret"
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="flex-1 font-mono text-sm"
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" onClick={copySecret}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" onClick={handleRegenerateSecret}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Used to verify webhook signatures (HMAC-SHA256). Keep this secure!
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !name || !url || selectedEvents.length === 0}>
                  {isSubmitting ? 'Saving...' : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {webhooks.length === 0 ? (
          <div className="text-center py-12">
            <RotateCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">No webhooks configured</p>
            <p className="text-sm text-muted-foreground/80 mt-1">
              Create a webhook to start receiving real-time events
            </p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Webhook
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <Card key={webhook.id} className="border-l-4 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded',
                          webhook.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                        )}>
                          {webhook.active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Created {formatDate(webhook.createdAt)}
                        </span>
                      </div>
                      <h4 className="font-medium truncate">{webhook.name}</h4>
                      <p className="text-sm text-muted-foreground font-mono truncate mt-1">{webhook.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {webhook.events.map(event => (
                          <span
                            key={event}
                            className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                      {webhook.lastError && (
                        <div className="mt-2 flex items-center gap-1 text-sm text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          <span>Last error: {webhook.lastError}</span>
                        </div>
                      )}
                      {webhook.lastTriggered && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Last triggered: {formatLastTriggered(webhook.lastTriggered)}
                          {webhook.retryCount > 0 && (
                            <span className="ml-2 text-amber-600">
                              ({webhook.retryCount} retries)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyUrl(webhook.url)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(webhook)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(webhook.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}