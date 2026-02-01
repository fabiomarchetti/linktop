'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Stethoscope, UserCircle } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

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

      // Verifica sessione paziente
      const utenteSession = sessionStorage.getItem('linktop_utente')
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
          sessionStorage.removeItem('linktop_utente')
        }
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
    <div className="h-screen bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800 flex items-center justify-center p-3 sm:p-4 relative overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col h-full max-h-[95vh] justify-center">
        {/* Header - Compatto */}
        <div className="text-center mb-4 sm:mb-6 lg:mb-8">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center mb-2 sm:mb-3 shadow-2xl border-2 sm:border-4 border-white/30">
            <Heart className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-1 drop-shadow-2xl">
            LINKTOP
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-teal-100 font-semibold">
            Health Monitor System
          </p>
        </div>

        {/* Choice Cards - Sempre 2 colonne su tablet */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 max-w-4xl mx-auto w-full">
          {/* Card Paziente */}
          <button
            onClick={() => router.push('/utente')}
            className="group bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl border-2 sm:border-4 border-white/20 hover:border-white/40 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-emerald-500/50 focus:outline-none focus:ring-4 focus:ring-white/50"
          >
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              {/* Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:shadow-emerald-400/50 transition-all">
                <UserCircle className="w-9 h-9 sm:w-11 sm:h-11 lg:w-14 lg:h-14 text-white" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1">
                  Sono un Paziente
                </h2>
                <p className="text-xs sm:text-sm lg:text-base text-teal-100 font-medium">
                  Accedi con il tuo Codice Fiscale
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg group-hover:gap-3 transition-all">
                <span>Accedi</span>
                <span className="text-lg sm:text-xl">→</span>
              </div>
            </div>
          </button>

          {/* Card Staff */}
          <button
            onClick={() => router.push('/login')}
            className="group bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl border-2 sm:border-4 border-white/20 hover:border-white/40 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-cyan-500/50 focus:outline-none focus:ring-4 focus:ring-white/50"
          >
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              {/* Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:shadow-cyan-400/50 transition-all">
                <Stethoscope className="w-9 h-9 sm:w-11 sm:h-11 lg:w-14 lg:h-14 text-white" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1">
                  Sono dello Staff
                </h2>
                <p className="text-xs sm:text-sm lg:text-base text-teal-100 font-medium">
                  Personale sanitario autorizzato
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg group-hover:gap-3 transition-all">
                <span>Accedi</span>
                <span className="text-lg sm:text-xl">→</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer - Compatto */}
        <div className="text-center mt-4 sm:mt-6 text-white/60 text-xs sm:text-sm">
          <p>LINKTOP Health Monitor v1.0</p>
        </div>
      </div>
    </div>
  )
}
