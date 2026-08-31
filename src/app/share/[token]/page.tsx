'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Lock, Unlock, Copy, Check, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AnimatedTaskItem } from '@/components/animated-task-item'

interface SharedListData {
  list: {
    id: string
    name: string
    color: string
    emoji: string
  }
  tasks: Array<{
    id: string
    name: string
    description?: string | null
    date?: string | null
    deadline?: string | null
    estimate?: number | null
    priority?: string
    completed: boolean
    position: number
  }>
  shareInfo: {
    permission: 'view' | 'comment' | 'edit'
    expiresAt?: number
    ownerName: string
  }
}

export default function SharedListPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const urlPassword = searchParams.get('password')

  const [data, setData] = useState<SharedListData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState(urlPassword || '')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadSharedList()
  }, [token, password])

  const loadSharedList = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (password) params.set('password', password)

      const res = await fetch(`/api/share/${token}?${params.toString()}`)

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to load shared list')
      }

      const result = await res.json()
      setData(result)

      // Record access after successful load
      await fetch(`/api/share/${token}/access`, { method: 'POST' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared list')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadSharedList()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied to clipboard')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error && !data) {
    const needsPassword = error.includes('Password required')

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" />
              {needsPassword ? 'Password Required' : 'Access Denied'}
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            {needsPassword ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Enter Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Unlock
                </Button>
              </form>
            ) : (
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const { list, tasks, shareInfo } = data
  const canEdit = shareInfo.permission === 'edit'
  const canComment = shareInfo.permission === 'comment' || canEdit

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{list.emoji}</span>
              <div>
                <h1 className="text-2xl font-bold">{list.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Shared by {shareInfo.ownerName} · {shareInfo.permission} access
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`/list/${list.id}`, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in App
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {shareInfo.expiresAt && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            This share link expires on {new Date(shareInfo.expiresAt).toLocaleDateString()}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Tasks ({tasks.filter(t => !t.completed).length} remaining)
            </CardTitle>
            <CardDescription>
              {canEdit
                ? 'You can edit tasks in this list'
                : canComment
                ? 'You can view and comment on tasks'
                : 'View only access'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No tasks in this list</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks
                  .sort((a, b) => (a.completed === b.completed ? a.position - b.position : a.completed ? 1 : -1))
                  .map(task => (
                    <AnimatedTaskItem
                      key={task.id}
                      task={task as any}
                    />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <div className="text-center text-sm text-muted-foreground">
          <p>Shared via TaskFlow</p>
          <p className="mt-1">
            <a href="/" className="text-primary hover:underline">
              Create your own lists
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}