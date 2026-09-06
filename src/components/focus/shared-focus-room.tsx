'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Users,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Zap,
  Moon,
  Copy,
  UsersIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSharedFocusRoom, type SharedFocusRoom } from '@/lib/use-shared-focus-room'
import { generateRoomInviteCode } from '@/lib/focus/shared-focus-room-utils'
import useSWR from 'swr'

const TIMER_MODES: {
  mode: 'pomodoro' | 'shortBreak' | 'longBreak'
  label: string
  icon: React.ReactNode
  duration: number
}[] = [
  { mode: 'pomodoro', label: 'Focus', icon: <Zap className="h-4 w-4" />, duration: 25 * 60 },
  { mode: 'shortBreak', label: 'Break', icon: <Coffee className="h-4 w-4" />, duration: 5 * 60 },
  { mode: 'longBreak', label: 'Long Break', icon: <Moon className="h-4 w-4" />, duration: 15 * 60 },
]

const CLIENT_ID_STORAGE = 'taskflow-shared-room-client-id'
const CLIENT_NAME_STORAGE = 'taskflow-shared-room-client-name'

function getClientId(): string {
  if (typeof window === 'undefined') return 'anon'
  let id = localStorage.getItem(CLIENT_ID_STORAGE)
  if (!id) {
    id = `client_${Math.random().toString(36).slice(2, 12)}`
    localStorage.setItem(CLIENT_ID_STORAGE, id)
  }
  return id
}

function getClientName(): string {
  if (typeof window === 'undefined') return 'Someone'
  const name = localStorage.getItem(CLIENT_NAME_STORAGE)
  if (name) return name
  return `User ${Math.floor(Math.random() * 999)}`
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface SharedFocusRoomProps {
  workspaceId: string | null
}

export function SharedFocusRoom({ workspaceId }: SharedFocusRoomProps) {
  const clientId = getClientId()
  const clientName = getClientName()

  const [inviteCode, setInviteCode] = useState('')
  const [roomName, setRoomName] = useState('')

  const { data, error, isLoading, mutate } = useSWR<{
    rooms: SharedFocusRoom[]
  }>(
    workspaceId
      ? `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms`
      : null,
    fetcher,
    { refreshInterval: 5000 }
  )

  const roomsList = data?.rooms ?? []
  const room = roomsList[0] ?? null

  const [session, setSession] = useState<SharedFocusRoom['session'] | null>(null)
  const [localRemaining, setLocalRemaining] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Handle SSE room events
  useSharedFocusRoom(workspaceId, (event) => {
    if (event.type === 'room_updated' || event.type === 'room_session_state') {
      mutate()
    }
  })

  // Sync local state with the room fetched from SWR
  useEffect(() => {
    if (!room) {
      setSession(null)
      setLocalRemaining(0)
      return
    }

    const nextSession = room.session
    // Defer setState to avoid cascading-render lint violation
    requestAnimationFrame(() => {
      setSession(nextSession)
      if (nextSession.isRunning && nextSession.startedAt) {
        const elapsed = Math.floor((Date.now() - nextSession.startedAt) / 1000)
        const modeConfig = TIMER_MODES.find((m) => m.mode === nextSession.mode)
        const duration = modeConfig?.duration ?? 25 * 60
        setLocalRemaining(Math.max(0, duration - elapsed))
      } else {
        setLocalRemaining(nextSession.timeRemaining)
      }
    })
  }, [room])

  // Local timer ticker — only runs when the room's session is running
  useEffect(() => {
    if (!session?.isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const modeConfig = TIMER_MODES.find((m) => m.mode === session.mode)
    const duration = modeConfig?.duration ?? 25 * 60

    const tick = () => {
      const started = session.startedAt
      if (started === null) return
      const elapsed = Math.floor((Date.now() - started) / 1000)
      const remaining = Math.max(0, duration - elapsed)
      setLocalRemaining(remaining)

      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current)
        void completeSegment()
      }
    }

    tick()
    timerRef.current = setInterval(tick, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [session])

  const createRoom = async () => {
    if (!workspaceId || !roomName.trim()) return
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: roomName,
            clientId,
            memberName: clientName,
          }),
        }
      )
      if (!res.ok) throw new Error('Failed to create room')
      const body = (await res.json()) as { room: SharedFocusRoom }
      setInviteCode(generateRoomInviteCode(body.room.id))
      mutate()
      toast.success(`Created focus room: ${roomName}`)
    } catch {
      toast.error('Failed to create room')
    }
  }

  const joinWithCode = async (code: string) => {
    if (!workspaceId) return
    try {
      const roomId = `room_${code.toLowerCase()}`
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms/${encodeURIComponent(roomId)}?action=join`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, memberName: clientName }),
        }
      )
      if (!res.ok) throw new Error('Failed to join room')
      mutate()
      toast.success('Joined focus room')
    } catch {
      toast.error('Failed to join room')
    }
  }

  const startTimer = async () => {
    if (!room || !workspaceId) return
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms/${encodeURIComponent(room.id)}?action=update`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            isRunning: true,
            startedAt: Date.now(),
          }),
        }
      )
      if (!res.ok) throw new Error('Failed to start')
      mutate()
    } catch {
      toast.error('Failed to start timer')
    }
  }

  const pauseTimer = async () => {
    if (!room || !workspaceId) return
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms/${encodeURIComponent(room.id)}?action=update`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            isRunning: false,
          }),
        }
      )
      if (!res.ok) throw new Error('Failed to pause')
      mutate()
    } catch {
      toast.error('Failed to pause timer')
    }
  }

  const resetTimer = async () => {
    if (!room || !workspaceId) return
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms/${encodeURIComponent(room.id)}?action=reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        }
      )
      if (!res.ok) throw new Error('Failed to reset')
      mutate()
    } catch {
      toast.error('Failed to reset timer')
    }
  }

  const completeSegment = async () => {
    if (!room || !workspaceId) return
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms/${encodeURIComponent(room.id)}?action=complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        }
      )
      if (!res.ok) throw new Error('Failed to complete')
      mutate()
    } catch {
      toast.error('Failed to complete segment')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const isLeader = session?.leaderClientId === clientId

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading rooms...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-destructive">Failed to load rooms</p>
        </CardContent>
      </Card>
    )
  }

  // No room: show create/join UI
  if (!room) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Shared Focus Rooms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Room name (e.g. 'Sprint Planning')"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={createRoom}
              disabled={!roomName.trim() || !workspaceId}
            >
              Start a Shared Session
            </Button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <span className="relative inline-block px-2 text-xs text-muted-foreground">
              or join with a code
            </span>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Enter room code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => joinWithCode(inviteCode)}
              disabled={!inviteCode.trim()}
            >
              Join Room
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Room active: show room details
  const modeConfig = TIMER_MODES.find((m) => m.mode === session?.mode)
  const currentMode = modeConfig ?? TIMER_MODES[0]
  const timeDisplay = formatTime(localRemaining)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {room.name}
          </span>
          <div className="flex items-center gap-2">
            {room.members.length > 1 && (
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                {room.members.length} in room
              </Badge>
            )}
            <Badge variant={session?.isRunning ? 'default' : 'outline'}>
              {session?.isRunning ? 'Running' : 'Paused'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Members list */}
        <div className="flex -space-x-2 mb-2">
          {room.members.map((member) => (
            <div
              key={member.clientId}
              className="flex flex-col items-center"
              title={member.name}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2',
                  member.isLeader
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted bg-muted'
                )}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-muted-foreground mt-1 max-w-[60px] truncate">
                {member.name}
              </span>
            </div>
          ))}
        </div>

        {/* Timer display */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            {currentMode.icon}
            <span className="font-medium">{currentMode.label}</span>
          </div>
          <div className="font-mono text-4xl tabular-nums">{timeDisplay}</div>
          {session?.completedSessions > 0 && (
            <Badge variant="outline" className="text-xs">
              {session.completedSessions} completed
              {session.completedSessions === 1 ? '' : 's'}
            </Badge>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!session?.isRunning ? (
            <Button
              size="lg"
              onClick={startTimer}
              disabled={!isLeader && room.members.length > 1}
            >
              <Play className="h-5 w-5 mr-2" />
              Start
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              onClick={pauseTimer}
              disabled={!isLeader}
            >
              <Pause className="h-5 w-5 mr-2" />
              Pause
            </Button>
          )}

          <Button variant="outline" size="icon" onClick={resetTimer}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Invite code */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">Room code:</span>
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
            {generateRoomInviteCode(room.id)}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigator.clipboard.writeText(
                generateRoomInviteCode(room.id)
              )
            }
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
