import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const { plotId, userId, content } = await request.json()

    // Generate embedding using Claude API
    const embedding = await generateEmbedding(content)

    // Create comment with embedding
    const comment = await prisma.comment.create({
      data: {
        plotId,
        userId,
        content,
        // embedding will be stored via raw SQL since Prisma doesn't support vector type
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    return NextResponse.json(comment)
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const plotId = searchParams.get('plotId')

    if (!plotId) {
      return NextResponse.json({ error: 'plotId is required' }, { status: 400 })
    }

    const comments = await prisma.comment.findMany({
      where: {
        plotId: parseInt(plotId),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  // TODO: Implement Claude embedding generation
  return []
}

