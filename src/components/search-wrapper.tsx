"use client"

import { useState } from "react"
import { SearchDialog } from "@/components/search-dialog"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"

export function SearchWrapper() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <KeyboardShortcuts onSearchOpen={() => setIsOpen(true)} />
      <SearchDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}
