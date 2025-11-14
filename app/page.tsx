'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setUser } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        return
      }

      // Store user in localStorage
      setUser(data.user)
      console.log('Logged in:', data.user)
      // Redirect to map page
      router.push('/map')
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      // TODO: Store user session/token
      console.log('Registered:', data.user)
      // Redirect or switch to login
      setIsRegister(false)
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Blockly</h1>
          <p className="text-gray-600">Philadelphia Vacant Land Platform</p>
        </div>
        <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-5">
          {isRegister && (
            <div>
              <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-700">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="Enter your username"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              placeholder="Enter your password"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {loading ? (isRegister ? 'Registering...' : 'Logging in...') : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
              setEmail('')
              setUsername('')
              setPassword('')
            }}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </main>
  )
}

