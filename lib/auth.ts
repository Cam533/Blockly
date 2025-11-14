// Simple auth utilities using localStorage

export interface User {
  id: number
  username: string
  email: string
}

const USER_KEY = 'blockly_user'

export function setUser(user: User) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY)
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch {
        return null
      }
    }
  }
  return null
}

export function clearUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY)
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null
}

