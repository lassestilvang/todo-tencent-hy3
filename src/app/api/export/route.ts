import { NextResponse } from 'next/server'
import { getTasks, getLists, getLabels } from '@/lib/tasks'
import { stringify } from 'csv-stringify/sync'
import { format as formatDate } from 'date-fns'
import { z } from 'zod'
import type { Task } from '@/types'

const exportSchema = z.object({
  format: z.enum(['json', 'csv', 'ical']),
  include: z.object({
    tasks: z.boolean().optional(),
    lists: z.boolean().optional(),
    labels: z.boolean().optional(),
    completedTasks: z.boolean().optional(),
  }).optional(),
  filters: z.object({
    listId: z.string().optional(),
    view: z.enum(['today', 'next7', 'upcoming', 'all']).optional(),
    completed: z.boolean().optional(),
  }).optional(),
})

function tasksToCSV(tasks: Task[]): string {
  return stringify(tasks.map(task => ({
    id: task.id,
    name: task.name,
    description: task.description || '',
    date: task.date || '',
    deadline: task.deadline || '',
    estimate: task.estimate || '',
    actual_time: task.actual_time || 0,
    priority: task.priority || 'none',
    list_id: task.list_id || '',
    completed: task.completed ? 'true' : 'false',
    completed_at: task.completed_at || '',
    recurring: task.recurring || '',
    created_at: task.created_at,
    updated_at: task.updated_at,
  })), {
    header: true,
    columns: [
      'id', 'name', 'description', 'date', 'deadline', 'estimate',
      'actual_time', 'priority', 'list_id', 'completed', 'completed_at',
      'recurring', 'created_at', 'updated_at'
    ],
  })
}

function tasksToICAL(tasks: Task[]): string {
  const now = new Date()
  const dtStamp = formatDate(now, "yyyyMMdd'T'HHmmss'Z'")

  const events = tasks
    .filter(task => task.date || task.deadline)
    .map(task => {
      const dtStart = task.date
        ? formatDate(new Date(task.date), "yyyyMMdd'T'HHmmss'Z'")
        : formatDate(new Date(task.deadline!), "yyyyMMdd'T'HHmmss'Z'")

      const dtEnd = task.estimate
        ? formatDate(new Date(new Date(task.date || task.deadline!).getTime() + task.estimate * 60000), "yyyyMMdd'T'HHmmss'Z'")
        : dtStart

      return `BEGIN:VEVENT
UID:${task.id}@taskflow
DTSTAMP:${dtStamp}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${task.name}
DESCRIPTION:${(task.description || '').replace(/\n/g, '\\n')}
STATUS:${task.completed ? 'COMPLETED' : 'NEEDS-ACTION'}
END:VEVENT`
    })
    .join('\n')

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskFlow//TaskFlow//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events}
END:VCALENDAR`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const includeTasks = searchParams.get('includeTasks') !== 'false'
    const includeLists = searchParams.get('includeLists') !== 'false'
    const includeLabels = searchParams.get('includeLabels') !== 'false'
    const includeCompleted = searchParams.get('includeCompleted') !== 'false'
    const listId = searchParams.get('listId') || undefined
    const view = searchParams.get('view') as 'today' | 'next7' | 'upcoming' | 'all' | undefined
    const completed = searchParams.get('completed')
      ? searchParams.get('completed') === 'true'
      : undefined

    if (!['json', 'csv', 'ical'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use json, csv, or ical' }, { status: 400 })
    }

    // Fetch data
    const [tasks, lists, labels] = await Promise.all([
      includeTasks ? getTasks({ listId, view, completed }) : Promise.resolve([]),
      includeLists ? getLists() : Promise.resolve([]),
      includeLabels ? getLabels() : Promise.resolve([]),
    ])

    // Filter completed tasks if needed
    const filteredTasks = includeCompleted ? tasks : tasks.filter(t => !t.completed)

    if (format === 'csv') {
      const csv = tasksToCSV(filteredTasks)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="taskflow-export-${formatDate(new Date(), 'yyyy-MM-dd')}.csv"`,
        },
      })
    }

    if (format === 'ical') {
      const ical = tasksToICAL(filteredTasks)
      return new NextResponse(ical, {
        headers: {
          'Content-Type': 'text/calendar',
          'Content-Disposition': `attachment; filename="taskflow-export-${formatDate(new Date(), 'yyyy-MM-dd')}.ics"`,
        },
      })
    }

    // JSON format
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      tasks: filteredTasks,
      lists,
      labels,
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="taskflow-export-${formatDate(new Date(), 'yyyy-MM-dd')}.json"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = exportSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const { format: exportFormat, include = {}, filters = {} } = result.data
    const { listId, view, completed } = filters

    // Fetch data
    const [tasks, lists, labels] = await Promise.all([
      include.tasks !== false ? getTasks({ listId, view, completed }) : Promise.resolve([]),
      include.lists !== false ? getLists() : Promise.resolve([]),
      include.labels !== false ? getLabels() : Promise.resolve([]),
    ])

    const filteredTasks = include.completedTasks !== false ? tasks : tasks.filter(t => !t.completed)

    const dateStr = formatDate(new Date(), 'yyyy-MM-dd')

    if (exportFormat === 'csv') {
      const csv = tasksToCSV(filteredTasks)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="taskflow-export-${dateStr}.csv"`,
        },
      })
    }

    if (exportFormat === 'ical') {
      const ical = tasksToICAL(filteredTasks)
      return new NextResponse(ical, {
        headers: {
          'Content-Type': 'text/calendar',
          'Content-Disposition': `attachment; filename="taskflow-export-${dateStr}.ics"`,
        },
      })
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      tasks: filteredTasks,
      lists,
      labels,
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="taskflow-export-${dateStr}.json"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}