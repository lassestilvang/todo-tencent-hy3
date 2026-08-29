'use client'

import { useState } from 'react'
import {
  Trash2,
  List as ListIcon,
  Flag,
  Calendar,
  Tag,
  MoveVertical,
  X,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getLists } from '@/lib/tasks-client'
import { getLabels } from '@/lib/tasks-client'
import type { List, Label } from '@/types'

interface BulkOperationsToolbarProps {
  selectedTaskIds: string[]
  onClose: () => void
  onBulkAction: (action: BulkAction, value?: string) => void
}

type BulkAction =
  | 'delete'
  | 'move'
  | 'priority'
  | 'date'
  | 'label-add'
  | 'label-remove'
  | 'complete'
  | 'uncomplete'

export function BulkOperationsToolbar({
  selectedTaskIds,
  onClose,
  onBulkAction,
}: BulkOperationsToolbarProps) {
  const [lists, setLists] = useState<List[]>([])
  const [labels, setLabels] = useState<Label[]>([])

  // Fetch lists and labels on mount
  const [fetched, setFetched] = useState(false)

  const fetchData = async () => {
    if (!fetched) {
      try {
        const [allLists, allLabels] = await Promise.all([getLists(), getLabels()])
        setLists(allLists)
        setLabels(allLabels)
        setFetched(true)
      } catch (error) {
        console.error('Failed to fetch lists/labels:', error)
      }
    }
  }

  // Fetch when toolbar opens
  if (selectedTaskIds.length > 0 && !fetched) {
    fetchData()
  }

  if (selectedTaskIds.length === 0) return null

  const handleAction = (action: BulkAction) => {
    onBulkAction(action)
    onClose()
  }

  const handleActionWithValue = (action: BulkAction, value: string) => {
    onBulkAction(action, value)
    onClose()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="glass-effect rounded-xl shadow-2xl border p-4 flex items-center gap-3 min-w-[400px]">
        {/* Selected count */}
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
          <MoveVertical className="h-4 w-4 text-primary" />
          <span className="font-medium">
            {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1">
          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleAction('delete')}
            className="whitespace-nowrap"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>

          {/* Move to List */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap gap-1">
                <ListIcon className="h-3 w-3" />
                Move to
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {lists.map((list) => (
                <DropdownMenuItem
                  key={list.id}
                  onClick={() => handleActionWithValue('move', list.id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                  <span className="flex-1">{list.emoji} {list.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap gap-1">
                <Flag className="h-3 w-3" />
                Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleActionWithValue('priority', 'high')}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  High
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionWithValue('priority', 'medium')}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  Medium
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionWithValue('priority', 'low')}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Low
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionWithValue('priority', 'none')}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted" />
                  None
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Due Date */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap gap-1">
                <Calendar className="h-3 w-3" />
                Due Date
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleActionWithValue('date', 'today')}>
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionWithValue('date', 'tomorrow')}>
                Tomorrow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionWithValue('date', 'next-week')}>
                Next Week
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionWithValue('date', 'clear')}>
                Clear Date
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Labels - Add */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap gap-1">
                <Tag className="h-3 w-3" />
                Add Label
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {labels.map((label) => (
                <DropdownMenuItem
                  key={label.id}
                  onClick={() => handleActionWithValue('label-add', label.id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1">{label.icon} {label.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Labels - Remove */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap gap-1">
                <Tag className="h-3 w-3" />
                Remove Label
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {labels.map((label) => (
                <DropdownMenuItem
                  key={label.id}
                  onClick={() => handleActionWithValue('label-remove', label.id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1">{label.icon} {label.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Complete/Uncomplete */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap gap-1">
                <MoreHorizontal className="h-3 w-3" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleAction('complete')}>
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('uncomplete')}>
                Mark Incomplete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Close button */}
        <Button variant="ghost" size="icon" onClick={onClose} className="ml-2">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}