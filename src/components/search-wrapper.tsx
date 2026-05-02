'use client'

import { useState } from 'react'
import { SearchDialog } from '@/components/search-dialog'
import { CreateTaskForm } from '@/components/create-task-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'

export function SearchWrapper() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)

  return (
    <>
      <KeyboardShortcuts
        onSearchOpen={() => setIsSearchOpen(true)}
        onNewTask={() => setIsNewTaskOpen(true)}
      />
      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your todo list
            </DialogDescription>
          </DialogHeader>
          <CreateTaskForm />
        </DialogContent>
      </Dialog>
    </>
  )
}
