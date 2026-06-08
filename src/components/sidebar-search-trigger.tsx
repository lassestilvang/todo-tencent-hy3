'use client'

import { SearchTrigger } from '@/components/search-wrapper'

export function SidebarSearchTrigger() {
  return (
    <div className="px-3 pb-2">
      <SearchTrigger size="sm" className="w-full justify-start" />
    </div>
  )
}
