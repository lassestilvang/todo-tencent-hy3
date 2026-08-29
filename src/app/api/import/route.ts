import { NextResponse } from 'next/server'
import { createTask, createList, createLabel } from '@/lib/tasks'
import { z } from 'zod'
import { parse as parseCSVSync } from 'csv-parse/sync'

const importSchema = z.object({
  format: z.enum(['json', 'csv']),
  data: z.any(),
  options: z.object({
    skipDuplicates: z.boolean().optional(),
    defaultListId: z.string().optional(),
  }).optional(),
})

// JSON import types
const importTaskSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  date: z.string().optional(),
  deadline: z.string().optional(),
  estimate: z.number().int().positive().optional(),
  priority: z.enum(['high', 'medium', 'low', 'none']).optional(),
  list_id: z.string().optional(),
  completed: z.boolean().optional(),
  completed_at: z.string().optional(),
  recurring: z.enum(['every_day', 'every_week', 'every_weekday', 'every_month', 'every_year', 'custom']).optional(),
})

const importListSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emoji: z.string().max(4).optional(),
})

const importLabelSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().max(4).optional(),
})

const importDataSchema = z.object({
  tasks: z.array(importTaskSchema).optional(),
  lists: z.array(importListSchema).optional(),
  labels: z.array(importLabelSchema).optional(),
})

function parseCSV(csvText: string): any[] {
  return parseCSVSync(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
}

function parseCSVTasks(csvData: any[]): z.infer<typeof importTaskSchema>[] {
  return csvData.map(row => ({
    name: row.name || row.title || '',
    description: row.description || row.notes || undefined,
    date: row.date || row.due_date || row.dueDate || undefined,
    deadline: row.deadline || undefined,
    estimate: row.estimate ? parseInt(row.estimate, 10) : undefined,
    priority: (row.priority?.toLowerCase() as 'high' | 'medium' | 'low' | 'none') || 'none',
    list_id: row.list_id || row.list || undefined,
    completed: row.completed === 'true' || row.completed === '1',
    recurring: row.recurring as 'every_day' | 'every_week' | 'every_weekday' | 'every_month' | 'every_year' | 'custom' | undefined,
  })).filter(t => t.name)
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let format = 'json'
    let data: any
    let options: { skipDuplicates?: boolean; defaultListId?: string } = {}

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File
      const formatParam = formData.get('format') as string
      const optionsParam = formData.get('options') as string

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      format = formatParam || (file.name.endsWith('.csv') ? 'csv' : 'json')
      options = optionsParam ? JSON.parse(optionsParam) : {}

      const text = await file.text()
      data = format === 'csv' ? parseCSV(text) : JSON.parse(text)
    } else {
      // Handle JSON body
      const body = await request.json()
      const result = importSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: result.error.format() },
          { status: 400 }
        )
      }
      format = result.data.format
      data = result.data.data
      options = result.data.options || {}
    }

    let importData: z.infer<typeof importDataSchema>

    if (format === 'csv') {
      if (!Array.isArray(data)) {
        return NextResponse.json({ error: 'CSV data must be an array' }, { status: 400 })
      }
      importData = {
        tasks: parseCSVTasks(data),
        lists: [],
        labels: [],
      }
    } else {
      // JSON format
      const result = importDataSchema.safeParse(data)
      if (!result.success) {
        return NextResponse.json(
          { error: 'Invalid JSON format', details: result.error.format() },
          { status: 400 }
        )
      }
      importData = result.data
    }

    const results = {
      tasks: { created: 0, skipped: 0, errors: [] as string[] },
      lists: { created: 0, skipped: 0, errors: [] as string[] },
      labels: { created: 0, skipped: 0, errors: [] as string[] },
    }

    // Import lists first (tasks may reference them)
    if (importData.lists?.length) {
      for (const list of importData.lists) {
        try {
          createList(list.name, list.color, list.emoji || '📝')
          results.lists.created++
        } catch (error) {
          results.lists.errors.push(`Failed to create list "${list.name}": ${error}`)
        }
      }
    }

    // Import labels
    if (importData.labels?.length) {
      for (const label of importData.labels) {
        try {
          createLabel(label.name, label.color, label.icon || '🏷️')
          results.labels.created++
        } catch (error) {
          results.labels.errors.push(`Failed to create label "${label.name}": ${error}`)
        }
      }
    }

    // Import tasks
    if (importData.tasks?.length) {
      for (const task of importData.tasks) {
        try {
          createTask({
            name: task.name,
            description: task.description,
            date: task.date,
            deadline: task.deadline,
            estimate: task.estimate,
            priority: task.priority,
            list_id: task.list_id || options.defaultListId,
            completed: task.completed,
            completed_at: task.completed_at,
            recurring: task.recurring,
          })
          results.tasks.created++
        } catch (error) {
          results.tasks.errors.push(`Failed to create task "${task.name}": ${error}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}