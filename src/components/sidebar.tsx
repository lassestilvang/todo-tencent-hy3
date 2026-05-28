import Link from 'next/link'
import { CalendarDays, Calendar, Clock, ListTodo, Plus } from 'lucide-react'
import { getLists, getLabels, getOverdueTasks } from '@/lib/tasks'
import { Button } from '@/components/ui/button'
import { CreateListForm } from '@/components/create-list-form'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export async function Sidebar() {
  const lists = getLists()
  const labels = getLabels()
  const overdue = getOverdueTasks()
  return (
    <aside className="glass-effect hidden h-full w-64 flex-col border-r md:flex">
      <div className="flex items-center justify-between border-b p-4">
        <h1 className="from-primary bg-gradient-to-r to-indigo-500 bg-clip-text text-xl font-bold text-transparent">
          TaskFlow
        </h1>
        <ThemeToggle />
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-3">
        <nav className="space-y-1">
          <SidebarLink
            href="/today"
            icon={CalendarDays}
            label="Today"
            badge={overdue.length > 0 ? overdue.length : undefined}
          />
          <SidebarLink href="/next7" icon={Clock} label="Next 7 Days" />
          <SidebarLink href="/upcoming" icon={Calendar} label="Upcoming" />
          <SidebarLink href="/all" icon={ListTodo} label="All Tasks" />
        </nav>

        <div>
          <div className="mb-2 flex items-center justify-between px-3">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase">
              Lists
            </h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New List</DialogTitle>
                  <DialogDescription>
                    Add a new list to organize your tasks
                  </DialogDescription>
                </DialogHeader>
                <CreateListForm />
              </DialogContent>
            </Dialog>
          </div>
          <nav className="space-y-1">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/list/${list.id}`}
                className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
              >
                <span>{list.emoji}</span>
                <span className="flex-1">{list.name}</span>
                {list.incomplete_count ? (
                  <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-xs">
                    {list.incomplete_count}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>

        {labels.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between px-3">
              <h3 className="text-muted-foreground text-xs font-semibold uppercase">
                Labels
              </h3>
            </div>
            <nav className="space-y-1">
              {labels.map((label) => (
                <Link
                  key={label.id}
                  href={`/label/${label.id}`}
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
                >
                  <span>{label.icon}</span>
                  <span className="flex-1">{label.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </aside>
  )
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: number
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge !== undefined && (
        <span className="bg-destructive text-destructive-foreground ml-auto rounded-full px-1.5 py-0.5 text-xs">
          {badge}
        </span>
      )}
    </Link>
  )
}
