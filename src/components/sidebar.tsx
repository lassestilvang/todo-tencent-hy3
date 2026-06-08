import { CalendarDays, Calendar, Clock, ListTodo, Plus } from 'lucide-react'
import { getLists, getLabels, getOverdueTasks } from '@/lib/tasks'
import { Button } from '@/components/ui/button'
import { CreateListForm } from '@/components/create-list-form'
import { CreateLabelForm } from '@/components/create-label-form'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SidebarLink } from '@/components/sidebar-link'

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
            icon={<CalendarDays className="h-4 w-4" />}
            label="Today"
            badge={overdue.length > 0 ? overdue.length : undefined}
          />
          <SidebarLink
            href="/next7"
            icon={<Clock className="h-4 w-4" />}
            label="Next 7 Days"
          />
          <SidebarLink
            href="/upcoming"
            icon={<Calendar className="h-4 w-4" />}
            label="Upcoming"
          />
          <SidebarLink
            href="/all"
            icon={<ListTodo className="h-4 w-4" />}
            label="All Tasks"
          />
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
            {lists.length === 0 ? (
              <p className="text-muted-foreground/70 px-3 py-2 text-xs italic">
                No lists yet. Create one above!
              </p>
            ) : (
              lists.map((list) => (
                <SidebarLink
                  key={list.id}
                  href={`/list/${list.id}`}
                  label={list.name}
                  icon={<span>{list.emoji}</span>}
                  badge={
                    list.incomplete_count ? list.incomplete_count : undefined
                  }
                />
              ))
            )}
          </nav>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between px-3">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase">
              Labels
            </h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Label</DialogTitle>
                  <DialogDescription>
                    Add a new label to categorize your tasks
                  </DialogDescription>
                </DialogHeader>
                <CreateLabelForm />
              </DialogContent>
            </Dialog>
          </div>
          <nav className="space-y-1">
            {labels.length === 0 ? (
              <p className="text-muted-foreground/70 px-3 py-2 text-xs italic">
                No labels yet. Create one above!
              </p>
            ) : (
              labels.map((label) => (
                <SidebarLink
                  key={label.id}
                  href={`/label/${label.id}`}
                  label={label.name}
                  icon={<span>{label.icon}</span>}
                />
              ))
            )}
          </nav>
        </div>
      </div>
    </aside>
  )
}
