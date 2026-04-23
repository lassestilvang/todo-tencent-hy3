import { NextResponse } from "next/server"
import { toggleTaskComplete } from "@/lib/tasks"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  toggleTaskComplete(id)
  return NextResponse.json({ success: true })
}
