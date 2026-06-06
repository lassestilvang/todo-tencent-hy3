'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function SidebarLink({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }> | (() => JSX.Element)
  label: string
  badge?: number
}) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 py-0.5 text-xs',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive text-destructive-foreground'
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
