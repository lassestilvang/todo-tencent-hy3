import { NextResponse } from "next/server"
import { deleteTask } from "@/lib/tasks"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  deleteTask(id)
  return NextResponse.json({ success: true })
}
