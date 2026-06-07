'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SidebarLayout({
  sidebar,
  children,
  search,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
  search: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={cn(
          'bg-background fixed inset-y-0 left-0 z-30 w-64 transform border-r transition-transform duration-200 ease-in-out md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebar}
      </div>
      {isOpen && (
        <div
          className="bg-background/50 fixed inset-0 z-20 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 p-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <span className="text-lg font-bold">TaskFlow</span>
        </header>
        <main id="main" className="flex-1 overflow-auto">
          {children}
        </main>
        {search}
      </div>
    </div>
  )
}
