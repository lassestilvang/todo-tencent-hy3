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
        required
        className="bg-background/40 border-border/40 focus:border-primary/50 focus:ring-primary/20 h-11 rounded-xl transition-all"
      />
      <div className="space-y-2">
        <label
          id="emoji-label"
          className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase"
        >
          Emoji
        </label>
        <div
          className="bg-accent/10 border-border/5 flex flex-wrap gap-1.5 rounded-xl border p-2"
          role="radiogroup"
          aria-labelledby="emoji-label"
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Select emoji ${e}`}
              onClick={() => setEmoji(e)}
              className={`hover:bg-accent/40 flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all duration-200 hover:scale-110 active:scale-75 ${emoji === e ? 'bg-accent/60 ring-primary/40 ring-2' : ''}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label
          id="color-label"
          className="text-muted-foreground/80 block text-xs font-semibold tracking-wider uppercase"
        >
          Color
        </label>
        <div
          className="bg-accent/10 border-border/5 flex flex-wrap gap-2 rounded-xl border p-2.5"
          role="radiogroup"
          aria-labelledby="color-label"
        >
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Select color ${c}`}
              onClick={() => setColor(c)}
              className={`h-6 w-6 cursor-pointer rounded-full transition-all duration-200 hover:scale-110 active:scale-75 ${color === c ? 'ring-primary ring-offset-background ring-2 ring-offset-2' : 'opacity-85 hover:opacity-100'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="pt-2">
        <Button
          type="submit"
          className="hover:shadow-primary/25 w-full font-semibold shadow-lg transition-all duration-200"
        >
          Create List
        </Button>
      </div>
    </form>
  )
}
