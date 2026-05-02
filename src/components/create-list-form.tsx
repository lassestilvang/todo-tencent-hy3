'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createListAction } from '@/lib/actions'

const EMOJIS = [
  '📋',
  '🏠',
  '💼',
  '🎯',
  '📚',
  '🎨',
  '💻',
  '🏃',
  '🍽️',
  '✈️',
  '🛒',
  '🎵',
]
const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
]

export function CreateListForm() {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [emoji, setEmoji] = useState(EMOJIS[0])

  async function handleSubmit(formData: FormData) {
    formData.set('color', color)
    formData.set('emoji', emoji)
    await createListAction(formData)
    setName('')
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Input
        name="name"
        placeholder="List name"
        aria-label="List name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        required
      />
      <div className="space-y-2">
        <label className="text-sm font-medium">Emoji</label>
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Select emoji ${e}`}
              onClick={() => setEmoji(e)}
              className={`hover:bg-accent flex h-8 w-8 items-center justify-center rounded text-lg ${emoji === e ? 'bg-accent ring-primary ring-2' : ''}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Color</label>
        <div className="flex flex-wrap gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Select color ${c}`}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full ${color === c ? 'ring-offset-background ring-2 ring-offset-2' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full">
        Create List
      </Button>
    </form>
  )
}
