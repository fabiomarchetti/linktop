'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Stethoscope, UserCircle, Maximize2, Minimize2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Gestione fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])

  // Listener per cambio stato fullscreen (es. ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    // Verifica se ci sono sessioni attive
    if (typeof window !== 'undefined') {
      // Verifica sessione staff
      const staffSession = localStorage.getItem('linktop_user')
      if (staffSession) {
        try {
          const userData = JSON.parse(staffSession)
          if (userData && userData.id && userData.username) {
            // Sessione staff valida → redirect a dashboard
            router.push('/dashboard')
            return
          }
        } catch (e) {
          // Sessione corrotta, rimuovi
          localStorage.removeItem('linktop_user')
        }
      }

      // Verifica sessione paziente (ora in localStorage)
      const utenteSession = localStorage.getItem('linktop_utente')
      if (utenteSession) {
        try {
          const utenteData = JSON.parse(utenteSession)
          if (utenteData && utenteData.id && utenteData.codice_fiscale) {
            // Sessione paziente valida → redirect a home paziente
            router.push('/utente/home')
            return
          }
        } catch (e) {
          // Sessione corrotta, rimuovi
          localStorage.removeItem('linktop_utente')
        }
      }

      // === RILEVAMENTO DISPOSITIVO PAZIENTE ===
      const userAgent = navigator.userAgent
      const isTCLDevice = userAgent.includes('TCL') || userAgent.includes('T509K')
      const isPatientResolution =
        (window.screen.width === 720 && window.screen.height === 1600) || // Portrait
        (window.screen.width === 1600 && window.screen.height === 720)    // Landscape
      const wasPatientDevice = localStorage.getItem('linktop_device_type') === 'patient'

      // === RILEVAMENTO SMARTPHONE (viewport < 640px) ===
      // Smartphone = sicuramente paziente, redirect diretto a /utente
      const isSmartphone = window.innerWidth < 640

      // Se è un dispositivo paziente o smartphone, redirect diretto a /utente
      if (isTCLDevice || isPatientResolution || wasPatientDevice || isSmartphone) {
        // Salva la preferenza per visite future
        localStorage.setItem('linktop_device_type', 'patient')
        router.push('/utente')
        return
      }

      // Nessuna sessione attiva → mostra landing page
      setIsChecking(false)
    }
  }, [router])

  // Mostra loading durante verifica sessioni
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800">
        <div className="text-white text-2xl font-semibold flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <p>Caricamento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800 flex items-center justify-center p-2 sm:p-3 relative overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-2 right-2 z-20 p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 backdrop-blur-lg rounded-full transition-all border border-white/30"
        title={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        ) : (
          <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        )}
      </button>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col h-full max-h-[88vh] justify-start pt-6 sm:pt-8">
        {/* Header - Ottimizzato per 600x960 */}
        <div className="text-center mb-3 sm:mb-4 lg:mb-6">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center shadow-2xl border-2 border-white/30 mb-2">
            <Heart className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white drop-shadow-2xl">
            Monitoraggio Salute
          </h1>
        </div>

        {/* Choice Cards - Sempre 2 colonne, ottimizzato per 600x960 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto w-full px-2">
          {/* Card Paziente */}
          <button
            onClick={() => router.push('/utente')}
            className="group bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-2xl border-2 border-white/20 hover:border-white/40 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <div className="flex flex-col items-center gap-2 sm:gap-3 lg:gap-4">
              {/* Icon */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:shadow-emerald-400/50 transition-all">
                <UserCircle className="w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 text-white" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white">
                  Paziente
                </h2>
                <p className="text-xs sm:text-sm lg:text-base text-teal-100 font-medium">
                  Codice Fiscale
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-1.5 text-white font-bold text-sm sm:text-base group-hover:gap-2 transition-all">
                <span>Accedi</span>
                <span className="text-base sm:text-lg">→</span>
              </div>
            </div>
          </button>

          {/* Card Staff */}
          <button
            onClick={() => router.push('/login')}
            className="group bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-2xl border-2 border-white/20 hover:border-white/40 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <div className="flex flex-col items-center gap-2 sm:gap-3 lg:gap-4">
              {/* Icon */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:shadow-cyan-400/50 transition-all">
                <Stethoscope className="w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 text-white" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white">
                  Staff
                </h2>
                <p className="text-xs sm:text-sm lg:text-base text-teal-100 font-medium">
                  Personale autorizzato
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-1.5 text-white font-bold text-sm sm:text-base group-hover:gap-2 transition-all">
                <span>Accedi</span>
                <span className="text-base sm:text-lg">→</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer - Compatto */}
        <div className="text-center mt-1.5 sm:mt-3 text-white/50 text-[9px] sm:text-[10px]">
          <p>LINKTOP v1.0</p>
        </div>
      </div>
    </div>
  )
}
