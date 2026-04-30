import { TaskList } from "@/components/task-list"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Upcoming Tasks - TaskFlow",
  description: "View and manage your upcoming tasks",
}

export default function UpcomingPage() {
  return <TaskList view="upcoming" title="Upcoming" />
}
