import { NextResponse } from "next/server"
import { getTasks, createTask, toggleTaskComplete, deleteTask, getTask } from "@/lib/tasks"
import type { Task } from "@/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') as Task['priority'] | null
  const listId = searchParams.get('listId')
  const completed = searchParams.get('completed')

  const tasks = getTasks({
    view: view as any,
    listId: listId || undefined,
    completed: completed === 'true' ? true : completed === 'false' ? false : undefined,
  })

  return NextResponse.json(tasks)
}

export async function POST(request: Request) {
  const data = await request.json()
  const task = createTask(data)
  return NextResponse.json(task)
}

export async function PATCH(request: Request) {
  const { id, ...data } = await request.json()
  const { toggleTaskComplete: toggle, deleteTask: del } = await import('@/lib/tasks')

  if (data.action === 'toggle') {
    toggle(id)
    return NextResponse.json({ success: true })
  }

  if (data.action === 'delete') {
    del(id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
