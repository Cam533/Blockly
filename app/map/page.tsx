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
    <main className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <div className="px-6 py-4 bg-white shadow-md border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Blockly</h1>
            <p className="text-xs text-gray-500">Philadelphia Vacant Land</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm font-semibold text-gray-900">{user.username}</p>
            </div>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-semibold">{user.username.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 relative">
        <MapComponent user={user!} />
      </div>
    </main>
  )
}
