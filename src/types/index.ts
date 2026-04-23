export type Priority = 'high' | 'medium' | 'low' | 'none'
export type RecurringType = 'every_day' | 'every_week' | 'every_weekday' | 'every_month' | 'every_year' | 'custom' | null

export interface List {
  id: string
  name: string
  color: string
  emoji: string
  created_at: string
  updated_at: string
  task_count?: number
  incomplete_count?: number
}

export interface Label {
  id: string
  name: string
  color: string
  icon: string
  created_at: string
}

export interface TaskLabel {
  task_id: string
  label_id: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

export interface TaskReminder {
  id: string
  task_id: string
  reminder_time: string
  sent: number
  created_at: string
}

export interface TaskLog {
  id: string
  task_id: string
  action: string
  details: string | null
  created_at: string
}

export interface Task {
  id: string
  name: string
  description: string | null
  date: string | null
  deadline: string | null
  estimate: number | null
  actual_time: number
  priority: Priority
  recurring: RecurringType
  list_id: string | null
  parent_task_id: string | null
  completed: number
  completed_at: string | null
  position: number
  created_at: string
  updated_at: string
  labels?: Label[]
  sub_tasks?: Task[]
  attachments?: TaskAttachment[]
  reminders?: TaskReminder[]
  logs?: TaskLog[]
  list?: List
}

export interface View {
  id: string
  name: string
  icon: string
  type: 'today' | 'next7' | 'upcoming' | 'all'
}

export type Theme = 'light' | 'dark' | 'system'
