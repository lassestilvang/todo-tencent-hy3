import Link from "next/link"
import { Inbox, CalendarDays, Calendar, Clock, ListTodo, Tag, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { getLists, getLabels, getOverdueTasks } from "@/lib/tasks"
import type { List, Label } from "@/types"
import { Button } from "@/components/ui/button"
import { CreateListForm } from "@/components/create-list-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { SearchDialog } from "@/components/search-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export async function Sidebar() {
  const lists = getLists()
  const labels = getLabels()
  const overdue = getOverdueTasks()

  return (
    <aside className="w-64 border-r bg-card hidden md:flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="text-xl font-bold">TaskFlow</h1>
        <ThemeToggle />
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-6">
        <div>
          <SearchDialogWrapper />
        </div>

        <nav className="space-y-1">
          <SidebarLink href="/today" icon={CalendarDays} label="Today" badge={overdue.length > 0 ? overdue.length : undefined} />
          <SidebarLink href="/next7" icon={Clock} label="Next 7 Days" />
          <SidebarLink href="/upcoming" icon={Calendar} label="Upcoming" />
          <SidebarLink href="/all" icon={ListTodo} label="All Tasks" />
        </nav>

        <div>
          <div className="flex items-center justify-between mb-2 px-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Lists</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="w-5 h-5">
                  <Plus className="w-3 h-3" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New List</DialogTitle>
                </DialogHeader>
                <CreateListForm />
              </DialogContent>
            </Dialog>
          </div>
          <nav className="space-y-1">
            {lists.map(list => (
              <Link
                key={list.id}
                href={`/list/${list.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <span>{list.emoji}</span>
                <span className="flex-1">{list.name}</span>
                {list.incomplete_count ? (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {list.incomplete_count}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>

        {labels.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Labels</h3>
            </div>
            <nav className="space-y-1">
              {labels.map(label => (
                <Link
                  key={label.id}
                  href={`/label/${label.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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

function SidebarLink({ href, icon: Icon, label, badge }: { href: string; icon: any; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge !== undefined && (
        <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </Link>
  )
}

async function SearchDialogWrapper() {
  return (
    <div>
      <form action="/search" method="GET">
        <button
          type="submit"
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
        >
          <Search className="w-4 h-4" />
          Search tasks...
        </button>
      </form>
    </div>
  )
}
