'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, type User } from '@/lib/auth'

export default function MapPage() {
  const router = useRouter()
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = getUser()
    if (!currentUser) {
      // Redirect to login if not authenticated
      router.push('/')
    } else {
      setUserState(currentUser)
      setLoading(false)
    }
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Map</h1>
        {user && (
          <div className="text-sm">
            Logged in as: <span className="font-semibold">{user.username}</span>
          </div>
        )}
      </div>
      <p>Map page - plots will be displayed here</p>
    </main>
  )
}

