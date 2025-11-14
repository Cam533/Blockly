import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 10 } = await request.json()

    // TODO: Generate embedding for query
    // TODO: Use pgvector to find similar comments
    // const results = await prisma.$queryRaw`
    //   SELECT * FROM comments
    //   ORDER BY embedding <-> ${queryEmbedding}::vector
    //   LIMIT ${limit}
    // `

    return NextResponse.json({ results: [] })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to search comments' }, { status: 500 })
  }
}

