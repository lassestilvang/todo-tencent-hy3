import { searchTasks } from "@/lib/tasks"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const results = searchTasks(q)
  return NextResponse.json(results)
}
