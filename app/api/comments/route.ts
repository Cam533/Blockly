import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const { postId, userId, content } = await request.json()

    // Generate embedding using Claude API
    const embedding = await generateEmbedding(content)

    // Create comment with embedding
    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content,
        // embedding will be stored via raw SQL since Prisma doesn't support vector type
      },
    })

    return NextResponse.json(comment)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  // TODO: Implement Claude embedding generation
  return []
}

