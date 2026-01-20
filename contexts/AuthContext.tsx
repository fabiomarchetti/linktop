'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// Interfaccia Ruolo
interface Ruolo {
  id: number
  nome: string
  descrizione: string
  livello_accesso: number
}

// Interfaccia User (da linktop_users)
interface User {
  id: number
  nome: string
  cognome: string
  username: string
  email?: string
  ruolo: string
  ruolo_id: number
  active: boolean
  ruoloDettaglio?: Ruolo
}

// Interfaccia Context
interface AuthContextType {
  user: User | null
  login: (userData: User) => void
  logout: () => void
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Carica utente da localStorage al mount
  useEffect(() => {
    const storedUser = localStorage.getItem('linktop_user')
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        setUser(userData)
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Errore parsing user data:', error)
        localStorage.removeItem('linktop_user')
      }
    }
    setIsLoading(false)
  }, [])

  // Helper: Registra un log di accesso
  const logAccess = async (userData: User, actionType: 'login' | 'logout' | 'page_visit', pageUrl?: string) => {
    try {
      await fetch('/api/access-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.id,
          username: userData.username,
          nome: userData.nome,
          cognome: userData.cognome,
          ruolo: userData.ruolo,
          action_type: actionType,
          page_url: pageUrl || null,
          ip_address: null, // Potrebbe essere ottenuto dal server
          user_agent: navigator.userAgent
        })
      })
    } catch (error) {
      console.error('Errore logging accesso:', error)
    }
  }

  const login = (userData: User) => {
    setUser(userData)
    setIsAuthenticated(true)
    localStorage.setItem('linktop_user', JSON.stringify(userData))

    // Log del login
    logAccess(userData, 'login')
  }

  const logout = () => {
    // Log del logout prima di rimuovere l'utente
    if (user) {
      logAccess(user, 'logout')
    }

    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('linktop_user')
    router.push('/')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
