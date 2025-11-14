import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const plotId = parseInt(params.id)

    if (isNaN(plotId)) {
      return NextResponse.json({ error: 'Invalid plot ID' }, { status: 400 })
    }

    // Fetch neighbors for this plot
    const neighbors = await (prisma as any).neighbors.findUnique({
      where: { id: plotId },
      select: {
        neighborIds: true,
      },
    })

    if (!neighbors) {
      return NextResponse.json({ neighborIds: [] })
    }

    return NextResponse.json({ neighborIds: neighbors.neighborIds || [] })
  } catch (error) {
    console.error('Error fetching neighbors:', error)
    // Return empty array if there's an error (e.g., table doesn't exist)
    return NextResponse.json({ neighborIds: [] })
  }
}

