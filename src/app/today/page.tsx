import { TaskList } from "@/components/task-list"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Today's Tasks - TaskFlow",
  description: "View and manage your tasks for today",
}

export default function TodayPage() {
  return <TaskList view="today" title="Today" />
}
