import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // TODO: Verify password (add password field to User model and hash comparison)
    // const isValid = await verifyPassword(password, user.password)
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    // }

    // TODO: Create session/JWT token
    // For now, return user data (implement proper session management)
    return NextResponse.json({ 
      user: { id: user.id, username: user.username, email: user.email },
      // token: sessionToken
    })
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

