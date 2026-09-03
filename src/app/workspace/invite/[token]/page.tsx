'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface InvitationData {
  workspaceId: string
  email: string
  role: string
  invitedByName: string
  workspaceName: string
  workspaceDescription?: string
  expiresAt: number
}

export default function WorkspaceInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [name, setName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function loadInvitation() {
      setIsLoading(true)
      setError(null)

      try {
        const invitationRes = await fetch(`/api/invitations?token=${encodeURIComponent(token)}`)
        if (!invitationRes.ok) {
          setError('Invalid or expired invitation link')
          setIsLoading(false)
          return
        }
        const invitationData = await invitationRes.json()
        const inv = invitationData.invitation

        if (inv.status !== 'pending') {
          setError('This invitation has already been used')
          setIsLoading(false)
          return
        }

        if (Date.now() > inv.expiresAt) {
          setError('This invitation has expired')
          setIsLoading(false)
          return
        }

        const workspaceRes = await fetch(`/api/workspaces?workspaceId=${encodeURIComponent(inv.workspaceId)}`)
        if (!workspaceRes.ok) {
          setError('Workspace not found')
          setIsLoading(false)
          return
        }
        const workspaceData = await workspaceRes.json()
        const workspace = workspaceData.workspace

        if (!mountedRef.current) return

        setInvitation({
          workspaceId: inv.workspaceId,
          email: inv.email,
          role: inv.role,
          invitedByName: inv.invitedByName,
          workspaceName: workspace.name,
          workspaceDescription: workspace.description,
          expiresAt: inv.expiresAt,
        })
      } catch {
        if (mountedRef.current) setError('Failed to load invitation')
      } finally {
        if (mountedRef.current) setIsLoading(false)
      }
    }

    loadInvitation()

    return () => {
      mountedRef.current = false
    }
  }, [token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invitation) return

    setIsAccepting(true)
    setError(null)

    // Get or ask for user name
    const userName = name.trim() || invitation.email.split('@')[0]
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId, userName }),
      })
      const result = await res.json()

      if (res.ok && result.success) {
        toast.success(`Welcome to ${invitation.workspaceName}!`)
        router.push('/')
      } else {
        setError(result.error || 'Failed to accept invitation')
      }
    } catch {
      setError('Failed to accept invitation')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this invitation?')) return

    try {
      const res = await fetch('/api/invitations/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (res.ok) {
        toast.success('Invitation declined')
        router.push('/')
      } else {
        toast.error('Failed to decline invitation')
      }
    } catch {
      toast.error('Failed to decline invitation')
    }
  }

  const formatExpiry = (timestamp: number) => {
    const now = new Date()
    const diffMs = timestamp - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) return 'Expired'
    if (diffDays === 1) return 'Expires tomorrow'
    return `Expires in ${diffDays} days`
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <CardTitle>Unable to Load Invitation</CardTitle>
            <CardDescription>{error || 'Invalid invitation link'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
          <CardTitle>Invitation to {invitation.workspaceName}</CardTitle>
          <CardDescription>
            {invitation.invitedByName} invited you to join as <strong>{invitation.role}</strong>
          </CardDescription>
        </CardHeader>

        {invitation.workspaceDescription && (
          <div className="px-6 mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            {invitation.workspaceDescription}
          </div>
        )}

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Email</Label>
            <Input
              type="email"
              value={invitation.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Your Role</Label>
            <div className="px-3 py-2 bg-muted rounded-lg">
              <span className="capitalize">{invitation.role}</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            {formatExpiry(invitation.expiresAt)}
          </div>

          {showNameInput && (
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDecline}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
          </div>

          {!showNameInput && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowNameInput(true)}
            >
              Enter a different name
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}