'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getUser, type User } from '@/lib/auth'

// Dynamically import Map component to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false })

export default function MapPage() {
  const router = useRouter()
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = getUser()
    if (!currentUser) {
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
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '1rem', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Blockly - Philadelphia Vacant Land</h1>
        {user && (
          <div style={{ fontSize: '0.875rem' }}>
            Logged in as: <span style={{ fontWeight: '600' }}>{user.username}</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        <MapComponent user={user!} />
      </div>
    </main>
  )
}
