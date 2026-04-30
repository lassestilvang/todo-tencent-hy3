import { NextResponse } from "next/server"
import { getTasks, createTask, toggleTaskComplete, deleteTask } from "@/lib/tasks"
import type { View } from "@/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') as View['type'] | null
  const listId = searchParams.get('listId')
  const completed = searchParams.get('completed')

  const tasks = getTasks({
    view: view || undefined,
    listId: listId || undefined,
    completed: completed === 'true' ? true : completed === 'false' ? false : undefined,
  })

  return NextResponse.json(tasks)
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const task = createTask(data)
    return NextResponse.json(task)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, action } = await request.json()

    if (action === 'toggle') {
      toggleTaskComplete(id)
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      deleteTask(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
