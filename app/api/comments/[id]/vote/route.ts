import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { voteType } = await request.json() // 'upvote' or 'downvote'
    const commentId = parseInt(params.id)

    if (!voteType || !['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 })
    }

    // Get current comment
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Update vote count
    const updateData = voteType === 'upvote'
      ? { upvote: comment.upvote + 1 }
      : { downvote: comment.downvote + 1 }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error('Error voting on comment:', error)
    return NextResponse.json({ error: 'Failed to vote on comment' }, { status: 500 })
  }
}

