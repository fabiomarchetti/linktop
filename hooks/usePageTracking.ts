'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook per tracciare automaticamente le visite alle pagine
 * Registra ogni cambio di pagina nel sistema di log
 */
export function usePageTracking() {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    // Non tracciare se l'utente non è autenticato
    if (!isAuthenticated || !user) return

    // Non tracciare la pagina di login
    if (pathname === '/' || pathname === '/login') return

    // Registra la visita alla pagina
    const trackPageVisit = async () => {
      try {
        await fetch('/api/access-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            username: user.username,
            nome: user.nome,
            cognome: user.cognome,
            ruolo: user.ruolo,
            action_type: 'page_visit',
            page_url: pathname,
            ip_address: null,
            user_agent: navigator.userAgent
          })
        })
      } catch (error) {
        console.error('Errore tracking pagina:', error)
      }
    }

    trackPageVisit()
  }, [pathname, user, isAuthenticated])
}
