import { NextRequest, NextResponse } from 'next/server'
import {
  addComment,
  getTaskComments,
  updateComment,
  deleteComment,
} from '@/lib/workspaces'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId' },
        { status: 400 }
      )
    }

    const comments = getTaskComments(taskId)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Get comments error:', error)
    return NextResponse.json(
      { error: 'Failed to get comments' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const body = await request.json()
    const { taskId, userId, userName, content, userAvatar } = body

    if (!taskId || !userId || !userName || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, userId, userName, content' },
        { status: 400 }
      )
    }

    const comment = addComment(taskId, workspaceId, userId, userName, content, userAvatar)

    return NextResponse.json({
      success: true,
      comment,
    })
  } catch (error) {
    console.error('Add comment error:', error)
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { commentId, content, userId } = body

    if (!commentId || !content || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: commentId, content, userId' },
        { status: 400 }
      )
    }

    const comment = updateComment(commentId, content, userId)

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      comment,
    })
  } catch (error) {
    console.error('Update comment error:', error)
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')
    const userId = searchParams.get('userId')

    if (!commentId || !userId) {
      return NextResponse.json(
        { error: 'Missing commentId or userId' },
        { status: 400 }
      )
    }

    const success = deleteComment(commentId, userId)

    if (!success) {
      return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}