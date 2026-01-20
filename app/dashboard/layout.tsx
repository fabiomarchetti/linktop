'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePageTracking } from '@/hooks/usePageTracking'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  // Tracking automatico delle pagine visitate
  usePageTracking()

  useEffect(() => {
    // Verifica se l'utente staff è autenticato
    const checkStaffAuth = () => {
      if (typeof window !== 'undefined') {
        const staffUser = localStorage.getItem('linktop_user')

        if (!staffUser) {
          // Nessuna sessione staff trovata - redirect a pagina iniziale
          console.log('⛔ Accesso negato a /dashboard - Sessione staff non trovata')
          router.push('/')
          return
        }

        try {
          // Verifica che sia un oggetto valido
          const userData = JSON.parse(staffUser)

          if (userData && userData.id && userData.username) {
            // Sessione staff valida
            console.log('✅ Accesso consentito a /dashboard - Staff:', userData.username)
            setIsAuthorized(true)
          } else {
            // Dati corrotti
            console.log('⛔ Accesso negato - Dati staff corrotti')
            localStorage.removeItem('linktop_user')
            router.push('/')
          }
        } catch (error) {
          // Errore parsing
          console.log('⛔ Accesso negato - Errore parsing sessione staff')
          localStorage.removeItem('linktop_user')
          router.push('/')
        }
      }

      setIsChecking(false)
    }

    checkStaffAuth()
  }, [router])

  // Mostra loading durante la verifica
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 flex items-center justify-center">
        <div className="text-white text-2xl font-semibold flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <p>Verifica autenticazione...</p>
        </div>
      </div>
    )
  }

  // Mostra contenuto solo se autorizzato
  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
