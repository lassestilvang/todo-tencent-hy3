'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Bookmark,
  BookmarkPlus,
  Download,
  Link2,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  deleteFilterPreset,
  exportFilterPresets,
  filterToParams,
  loadFilterPresets,
  mergeFilterPresets,
  paramsToFilter,
  parseImportedPresets,
  replaceFilterPresets,
  saveFilterPreset,
  type FilterPreset,
} from '@/lib/filter-presets'

/**
 * Save the current task view as a named preset and
 * re-apply it later. Presets live in localStorage and
 * apply by navigating with the filter as query params.
 */
export function FilterPresets() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Presets are read from localStorage once on mount;
  // a lazy initializer avoids a setState-in-effect cascade.
  const [presets, setPresets] = useState<FilterPreset[]>(loadFilterPresets)
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [name, setName] = useState('')
  const [importText, setImportText] = useState('')

  const applyPreset = (preset: FilterPreset) => {
    const params = new URLSearchParams(filterToParams(preset.filter))
    const query = params.toString()
    router.push(`/all${query ? `?${query}` : ''}`)
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return

    const filter = paramsToFilter(
      Object.fromEntries(searchParams.entries())
    )
    const preset = saveFilterPreset(trimmed, filter)
    setPresets((prev) => [
      ...prev.filter((p) => p.id !== preset.id),
      preset,
    ])
    setName('')
    setIsSaveOpen(false)
    toast.success(`Filter preset "${preset.name}" saved`)
  }

  const handleDelete = (preset: FilterPreset) => {
    deleteFilterPreset(preset.id)
    setPresets((prev) => prev.filter((p) => p.id !== preset.id))
    toast.success(`Filter preset "${preset.name}" deleted`)
  }

  /** Share the current view as a URL anyone can open. */
  const handleCopyLink = async () => {
    const filter = paramsToFilter(
      Object.fromEntries(searchParams.entries())
    )
    const params = new URLSearchParams(filterToParams(filter))
    const query = params.toString()
    const url = `${window.location.origin}/all${
      query ? `?${query}` : ''
    }`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Filter link copied to clipboard')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  /** Download the presets as a JSON file. */
  const handleExport = () => {
    const blob = new Blob([exportFilterPresets()], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'taskflow-filter-presets.json'
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Filter presets exported')
  }

  const handleImport = () => {
    const imported = parseImportedPresets(importText)
    if (imported === null) {
      toast.error('That is not a valid presets file')
      return
    }

    const merged = mergeFilterPresets(
      loadFilterPresets(),
      imported
    )
    replaceFilterPresets(merged)
    setPresets(merged)
    setImportText('')
    setIsImportOpen(false)
    toast.success(
      `Imported ${imported.length} filter preset${
        imported.length === 1 ? '' : 's'
      }`
    )
  }

  return (
    <>
      <div className="flex justify-end p-4 md:px-6 lg:px-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Bookmark className="h-3 w-3" />
              Filter presets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Saved filters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                // Keep the menu open so the dialog can render.
                event.preventDefault()
                setIsSaveOpen(true)
              }}
            >
              <BookmarkPlus className="mr-2 h-3 w-3" />
              Save current view as preset
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleCopyLink}>
              <Link2 className="mr-2 h-3 w-3" />
              Copy shareable link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExport}>
              <Download className="mr-2 h-3 w-3" />
              Export presets
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                // Keep the menu open so the dialog can render.
                event.preventDefault()
                setIsImportOpen(true)
              }}
            >
              <Upload className="mr-2 h-3 w-3" />
              Import presets…
            </DropdownMenuItem>
            {presets.length > 0 && <DropdownMenuSeparator />}
            {presets.map((preset) => (
              <DropdownMenuItem key={preset.id} onSelect={() => applyPreset(preset)}>
                <span className="flex-1 truncate">{preset.name}</span>
                <button
                  type="button"
                  aria-label={`Delete preset ${preset.name}`}
                  className="ml-2 rounded p-0.5 text-muted-foreground/60 hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDelete(preset)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
            {presets.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No presets yet — save the current view to
                reuse it later.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save filter preset</DialogTitle>
            <DialogDescription>
              Name the current filters to apply them again with
              one click.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSave()
              }
            }}
            placeholder="e.g. Urgent inbox tasks"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsSaveOpen(false)
                setName('')
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
              Save preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import filter presets</DialogTitle>
            <DialogDescription>
              Paste the contents of an exported presets
              file. Presets with the same name are
              replaced.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='[{"name": "Urgent inbox", "filter": {"priority": "high", "listId": "inbox"}}]'
            className="font-mono text-xs"
            rows={6}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsImportOpen(false)
                setImportText('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!importText.trim()}
            >
              Import presets
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
