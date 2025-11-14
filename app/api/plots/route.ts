import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const plots = await prisma.plot.findMany({
      select: {
        id: true,
        objectid: true,
        longitude: true,
        latitude: true,
        address: true,
        vacantFlag: true,
        vacantRank: true,
      },
      where: {
        longitude: { not: null },
        latitude: { not: null },
      },
    })

    return NextResponse.json(plots)
  } catch (error) {
    console.error('Error fetching plots:', error)
    return NextResponse.json({ error: 'Failed to fetch plots' }, { status: 500 })
  }
}

