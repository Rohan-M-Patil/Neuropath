import { create } from 'zustand'

interface AuthState {
  token: string | null
  userId: string | null
  fullName: string | null
  email: string | null
  setAuth: (token: string, userId: string, fullName: string, email: string) => void
  logout: () => void
}

const TOKEN_KEY = 'neuropath_token'
const USER_KEY = 'neuropath_user'

function loadStored() {
  const token = localStorage.getItem(TOKEN_KEY)
  const userRaw = localStorage.getItem(USER_KEY)
  if (!token || !userRaw) return { token: null, userId: null, fullName: null, email: null }
  try {
    const user = JSON.parse(userRaw)
    return { token, userId: user.id, fullName: user.full_name, email: user.email }
  } catch {
    return { token: null, userId: null, fullName: null, email: null }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadStored(),
  setAuth: (token, userId, fullName, email) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify({ id: userId, full_name: fullName, email }))
    set({ token, userId, fullName, email })
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ token: null, userId: null, fullName: null, email: null })
  },
}))
