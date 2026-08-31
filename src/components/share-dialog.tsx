'use client'

import { useState, useEffect } from 'react'
import { Link2, Copy, Check, Trash2, Clock, Lock, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createShareLink, getListShareLinks, revokeShareLink, getShareUrl, formatExpiryDate, formatPermission, getPermissionColor, SharePermission } from '@/lib/share'

interface ShareDialogProps {
  listId: string
  listName: string
}

export function ShareDialog({ listId, listName }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create')
  const [permission, setPermission] = useState<SharePermission>('view')
  const [expiresInDays, setExpiresInDays] = useState<string>('')
  const [password, setPassword] = useState('')
  const [requirePassword, setRequirePassword] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [shareLinks, setShareLinks] = useState<Array<{
    id: string
    token: string
    url: string
    permission: SharePermission
    expiresAt?: number
    hasPassword: boolean
    createdAt: number
    accessCount: number
    lastAccessed?: number
  }>>([])
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  useEffect(() => {
    loadShareLinks()
  }, [listId])

  const loadShareLinks = () => {
    const links = getListShareLinks(listId)
    setShareLinks(links.map(link => ({
      ...link,
      url: getShareUrl(link.token),
      hasPassword: !!link.passwordHash,
    })))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      const link = createShareLink(listId, permission, {
        expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
        password: requirePassword && password ? password : undefined,
      })

      toast.success('Share link created!')
      setCopiedLink(link.token)
      loadShareLinks()
      setActiveTab('manage')

      // Reset form
      setExpiresInDays('')
      setPassword('')
      setRequirePassword(false)
    } catch (error) {
      toast.error('Failed to create share link')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevoke = (token: string) => {
    if (confirm('Revoke this share link? Anyone with the link will lose access.')) {
      revokeShareLink(token)
      loadShareLinks()
      toast.success('Share link revoked')
    }
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedLink(url)
    setTimeout(() => setCopiedLink(null), 2000)
    toast.success('Link copied!')
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  const formatLastAccessed = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - timestamp
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Link2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share "{listName}"
          </DialogTitle>
          <DialogDescription>
            Create links to share this list with others. Control what they can do.
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-[calc(100%-140px)] flex-col">
          {/* Tabs */}
          <div className="flex border-b mb-4">
            <button
              className={cn(
                'flex-1 py-2 px-4 text-sm font-medium transition-colors border-b-2',
                activeTab === 'create'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('create')}
            >
              Create Link
            </button>
            <button
              className={cn(
                'flex-1 py-2 px-4 text-sm font-medium transition-colors border-b-2',
                activeTab === 'manage'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('manage')}
            >
              Manage Links {shareLinks.length > 0 && `(${shareLinks.length})`}
            </button>
          </div>

          {/* Create Tab */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Permission Level</Label>
                <Select value={permission} onValueChange={(value: string) => setPermission(value as SharePermission)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">View</span>
                        <span>View only - can see tasks but not modify</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="comment">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">Comment</span>
                        <span>Can view and add comments (coming soon)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="edit">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">Edit</span>
                        <span>Full edit access - can add, edit, complete tasks</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Expiration (optional)</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger>
                    <SelectValue placeholder="Never expires" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Never expires</SelectItem>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">1 week</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Link will stop working after this period
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Password Protection</Label>
                  <Switch
                    checked={requirePassword}
                    onCheckedChange={setRequirePassword}
                  />
                </div>
                {requirePassword && (
                  <div className="space-y-2">
                    <Label htmlFor="share-password">Password</Label>
                    <Input
                      id="share-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Recipients will need this password to access the list
                    </p>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isCreating || (requirePassword && !password)}>
                {isCreating ? 'Creating...' : 'Create Share Link'}
              </Button>
            </form>
          )}

          {/* Manage Tab */}
          {activeTab === 'manage' && (
            <div className="flex-1 overflow-y-auto pr-4">
              {shareLinks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Link2 className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No share links yet</p>
                  <p className="text-sm">Create your first link to share this list</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shareLinks.map(link => (
                    <Card key={link.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                'px-2 py-0.5 text-xs font-medium rounded',
                                getPermissionColor(link.permission)
                              )}>
                                {formatPermission(link.permission)}
                              </span>
                              {link.hasPassword && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
                                  <Lock className="h-3 w-3 inline mr-1" /> Password
                                </span>
                              )}
                              {link.expiresAt && (
                                <span className={cn(
                                  'px-2 py-0.5 text-xs font-medium rounded',
                                  link.expiresAt < Date.now() ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                )}>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {formatExpiryDate(link.expiresAt)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <span className="font-mono text-xs truncate flex-1">{link.url}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyLink(link.url)}
                                disabled={copiedLink === link.token}
                              >
                                {copiedLink === link.token ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Created: {formatDate(link.createdAt)}</span>
                              <span>Accessed: {link.accessCount} times</span>
                              <span>Last: {formatLastAccessed(link.lastAccessed)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleRevoke(link.token)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}