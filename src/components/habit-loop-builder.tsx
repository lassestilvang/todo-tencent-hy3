'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Play, CheckCircle, Flame, BarChart3, Info } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Habit, HabitExecution, HabitWithStats } from '@/lib/habits'
import {
  calculateHabitStats,
  isHabitScheduled,
  describeHabitLoop,
  getHabitTemplates,
} from '@/lib/habits'

interface HabitLoopBuilderProps {
  habits: Habit[]
  executions: HabitExecution[]
  onHabitCreated?: (habit: Habit) => void
  onHabitUpdated?: (habit: Habit) => void
  onHabitDeleted?: (id: string) => void
  onHabitCompleted?: (habitId: string, satisfaction: number) => void
}

const CUE_OPTIONS = [
  { value: 'time', label: 'Time' },
  { value: 'location', label: 'Location' },
  { value: 'emotion', label: 'Emotion' },
  { value: 'preceding-action', label: 'Preceding Action' },
  { value: 'other-person', label: 'Other Person' },
  { value: 'environmental', label: 'Environmental' },
]

const REWARD_OPTIONS = [
  { value: 'tangible', label: 'Tangible' },
  { value: 'social', label: 'Social' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'status', label: 'Status' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'peace-of-mind', label: 'Peace of Mind' },
]

export function HabitLoopBuilder({
  habits = [],
  executions = [],
  onHabitCreated,
  onHabitUpdated,
  onHabitDeleted,
  onHabitCompleted,
}: HabitLoopBuilderProps) {
  const [editingHabit, setEditingHabit] = useState<Partial<Habit>>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'builder' | 'tracker'>('tracker')

  const templates = useMemo(() => getHabitTemplates(), [])

  const habitsWithStats = useMemo(() => {
    return habits.map((habit) => {
      const habitExecutions = executions.filter((e) => e.habitId === habit.id)
      return calculateHabitStats(habit, habitExecutions)
    })
  }, [habits, executions])

  const handleSaveHabit = () => {
    if (!editingHabit.name) {
      toast.error('Please give your habit a name')
      return
    }

    const habit: Habit = {
      id: editingHabit.id || `habit-${Date.now()}`,
      name: editingHabit.name,
      description: editingHabit.description || null,
      cue: editingHabit.cue || { type: 'time', value: '09:00' },
      craving: editingHabit.craving || '',
      response: editingHabit.response || '',
      reward: editingHabit.reward || { type: 'achievement', value: 'sense of accomplishment' },
      frequency: editingHabit.frequency || 'daily',
      schedule: editingHabit.schedule,
      taskIds: editingHabit.taskIds,
      createdAt: editingHabit.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: editingHabit.active ?? true,
    }

    if (editingHabit.id && habits.some((h) => h.id === editingHabit.id)) {
      onHabitUpdated?.(habit)
    } else {
      onHabitCreated?.(habit)
    }

    toast.success(`Habit ${editingHabit.id ? 'updated' : 'created'}: ${habit.name}`)
    setIsDialogOpen(false)
    setEditingHabit({})
  }

  const handleDeleteHabit = (id: string) => {
    if (confirm('Delete this habit and all its execution history?')) {
      onHabitDeleted?.(id)
      toast.success('Habit deleted')
    }
  }

  const handleCompleteHabit = (habitId: string, satisfaction: number) => {
    onHabitCompleted?.(habitId, satisfaction)
  }

  const renderHabitForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Habit Name</Label>
          <Input
            value={editingHabit.name || ''}
            onChange={(e) => setEditingHabit({ ...editingHabit, name: e.target.value })}
            placeholder="e.g. Morning Pages"
          />
        </div>
        <div>
          <Label>Frequency</Label>
          <Select
            value={editingHabit.frequency || 'daily'}
            onValueChange={(v) => setEditingHabit({ ...editingHabit, frequency: v as Habit['frequency'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={editingHabit.description || ''}
          onChange={(e) => setEditingHabit({ ...editingHabit, description: e.target.value })}
          placeholder="What is this habit about?"
          rows={3}
        />
      </div>

      <Separator>
        <span className="text-xs text-muted-foreground">Habit Loop</span>
      </Separator>

      {/* Cue */}
      <div className="space-y-2">
        <Label>1. Cue (What triggers this habit?)</Label>
        <Select
          value={editingHabit.cue?.type || 'time'}
          onValueChange={(type) =>
            setEditingHabit({
              ...editingHabit,
              cue: { type: type as Habit['cue']['type'], value: editingHabit.cue?.value || '' },
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select cue type" />
          </SelectTrigger>
          <SelectContent>
            {CUE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={editingHabit.cue?.value || ''}
          onChange={(e) =>
            setEditingHabit({
              ...editingHabit,
              cue: { type: editingHabit.cue?.type || 'time', value: e.target.value },
            })
          }
          placeholder={
            editingHabit.cue?.type === 'time' ? 'HH:MM' :
            editingHabit.cue?.type === 'emotion' ? 'e.g. energized, bored, stressed' :
            editingHabit.cue?.type === 'location' ? 'e.g. Kitchen, Office' :
            editingHabit.cue?.type === 'preceding-action' ? 'e.g. After finishing lunch' :
            editingHabit.cue?.type === 'other-person' ? 'e.g. with Alex' :
            editingHabit.cue?.type === 'environmental' ? 'e.g. desk setup complete' :
            'Describe the trigger'
          }
        />
      </div>

      {/* Craving */}
      <div>
        <Label>2. Craving (What do you want to feel?)</Label>
        <Input
          value={editingHabit.craving || ''}
          onChange={(e) => setEditingHabit({ ...editingHabit, craving: e.target.value })}
          placeholder="e.g. mental clarity, sense of accomplishment"
        />
      </div>

      {/* Response */}
      <div>
        <Label>3. Response (What action do you take?)</Label>
        <Input
          value={editingHabit.response || ''}
          onChange={(e) => setEditingHabit({ ...editingHabit, response: e.target.value })}
          placeholder="e.g. write 3 pages, do 5 minutes of stretching"
        />
      </div>

      {/* Reward */}
      <div className="space-y-2">
        <Label>4. Reward (What do you gain?)</Label>
        <Select
          value={editingHabit.reward?.type || 'achievement'}
          onValueChange={(type) =>
            setEditingHabit({
              ...editingHabit,
              reward: { type: type as Habit['reward']['type'], value: editingHabit.reward?.value || '' },
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select reward type" />
          </SelectTrigger>
          <SelectContent>
            {REWARD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={editingHabit.reward?.value || ''}
          onChange={(e) =>
            setEditingHabit({
              ...editingHabit,
              reward: { type: editingHabit.reward?.type || 'achievement', value: e.target.value },
            })
          }
          placeholder="e.g. peace of mind, a clear calm mind"
        />
      </div>

      {/* Show the loop description */}
      {editingHabit.name && editingHabit.cue && editingHabit.craving && editingHabit.response && editingHabit.reward && (
        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-sm font-medium mb-1">Your Habit Loop:</p>
          <p className="text-sm text-muted-foreground">{describeHabitLoop(editingHabit as Habit)}</p>
        </div>
      )}
    </div>
  )

  const renderTracker = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Habits</h3>
        <Button
          size="sm"
          onClick={() => {
            setEditingHabit({})
            setIsDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Habit
        </Button>
      </div>

      {habitsWithStats.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Flame className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No habits yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Build your first habit loop to start tracking consistency
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => {
                const template = templates[0]
                setEditingHabit({
                  ...template,
                  id: undefined,
                  createdAt: undefined,
                  updatedAt: undefined,
                  active: true,
                })
                setIsDialogOpen(true)
              }}
            >
              Start with a template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {habitsWithStats.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              executions={executions.filter((e) => e.habitId === habit.id)}
              onEdit={(h) => {
                setEditingHabit(h)
                setIsDialogOpen(true)
              }}
              onDelete={handleDeleteHabit}
              onComplete={handleCompleteHabit}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tracker">Habit Tracker</TabsTrigger>
          <TabsTrigger value="builder">Loop Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker" className="mt-0">
          {renderTracker()}
        </TabsContent>

        <TabsContent value="builder" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Habit Loop Builder</CardTitle>
              <CardDescription>
                Build a habit using the Cue → Craving → Response → Reward framework.
                Each element is configurable to match your psychology.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderHabitForm()}
              <div className="mt-6 flex gap-2">
                <Button onClick={handleSaveHabit}>
                  {editingHabit.id ? 'Update Habit' : 'Create Habit'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingHabit({})
                    setIsDialogOpen(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHabit.id ? 'Edit Habit' : 'New Habit'}</DialogTitle>
          </DialogHeader>
          {renderHabitForm()}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHabit}>
              {editingHabit.id ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function HabitCard({
  habit,
  executions,
  onEdit,
  onDelete,
  onComplete,
}: {
  habit: HabitWithStats
  executions: HabitExecution[]
  onEdit: (habit: Habit) => void
  onDelete: (id: string) => void
  onComplete: (id: string, satisfaction: number) => void
}) {
  const todayExecutions = executions.filter(
    (e) => e.completedAt.split('T')[0] === new Date().toISOString().split('T')[0]
  )
  const completedToday = todayExecutions.length > 0

  // Generate a 21-day mini heatmap
  const days = Array.from({ length: 21 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - 20 + i)
    return date.toISOString().split('T')[0]
  })

  const completionDates = new Set(
    executions.map((e) => e.completedAt.split('T')[0])
  )

  return (
    <Card className="glass-effect">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{habit.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={habit.active ? 'default' : 'secondary'}>
              {habit.active ? 'Active' : 'Paused'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(habit.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {habit.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Streak and stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <span className="font-bold text-lg">{habit.currentStreak}</span>
                <p className="text-xs text-muted-foreground">current streak</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <span className="font-bold text-lg">{habit.longestStreak}</span>
                <p className="text-xs text-muted-foreground">longest streak</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg">
                {Math.round(habit.consistencyRate * 100)}%
              </span>
              <p className="text-xs text-muted-foreground">consistency (30d)</p>
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={habit.consistencyRate * 100} className="h-2" />

          {/* Mini heatmap */}
          <div className="flex items-center gap-0.5">
            {days.map((day) => {
              const hasCompletion = completionDates.has(day)
              const level = hasCompletion ? 3 : 0
              const colors = [
                'bg-slate-200 dark:bg-slate-700',
                'bg-blue-200/60 dark:bg-blue-900/40',
                'bg-blue-300/70 dark:bg-blue-800/50',
                'bg-blue-500/70 dark:bg-blue-600/70',
              ]
              return (
                <div
                  key={day}
                  className={`h-3 w-3 rounded-sm ${colors[level]}`}
                  title={day}
                />
              )
            })}
          </div>

          {/* Loop description */}
          <div className="rounded-lg bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              {describeHabitLoop(habit)}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={completedToday ? 'outline' : 'default'}
              onClick={() => !completedToday && onComplete(habit.id, 4)}
              disabled={completedToday || !habit.active}
              className="flex-1"
            >
              {completedToday ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Done today
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Complete
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(habit)}
            >
              Edit
            </Button>
          </div>

          {todayExecutions.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>
                Completed at {format(new Date(todayExecutions[0].completedAt), 'h:mm a')}
                {todayExecutions[0].satisfaction &&
                  ` · ${todayExecutions[0].satisfaction}/5 satisfaction`}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
