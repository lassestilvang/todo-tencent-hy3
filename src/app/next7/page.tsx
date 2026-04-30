import { TaskList } from "@/components/task-list"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Next 7 Days - TaskFlow",
  description: "View and manage your tasks for the next 7 days",
}

export default function Next7Page() {
  return <TaskList view="next7" title="Next 7 Days" />
}
