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
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-24 h-24 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center mb-6 shadow-2xl border-4 border-white/30">
            <Heart className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-2xl">
            LINKTOP
          </h1>
          <p className="text-2xl md:text-3xl text-teal-100 font-semibold">
            Health Monitor System
          </p>
          <p className="text-lg md:text-xl text-white/80 mt-4">
            Seleziona il tipo di accesso
          </p>
        </div>

        {/* Choice Cards - Grid 2 colonne su desktop, 1 su mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
          {/* Card Paziente */}
          <button
            onClick={() => router.push('/utente')}
            className="group bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl border-4 border-white/20 hover:border-white/40 transition-all hover:scale-105 hover:shadow-emerald-500/50 focus:outline-none focus:ring-4 focus:ring-white/50"
          >
            <div className="flex flex-col items-center gap-6">
              {/* Icon */}
              <div className="w-28 h-28 md:w-32 md:h-32 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:shadow-emerald-400/50 transition-all">
                <UserCircle className="w-16 h-16 md:w-20 md:h-20 text-white" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
                  Sono un Paziente
                </h2>
                <p className="text-lg md:text-xl text-teal-100 font-medium">
                  Accedi con il tuo Codice Fiscale
                </p>
              </div>

              {/* Features */}
              <div className="space-y-2 text-white/90 text-base md:text-lg">
                <p>• Misurazioni parametri vitali</p>
                <p>• Monitor cardiaco</p>
                <p>• Stetoscopio digitale</p>
                <p>• Otoscopio</p>
              </div>

              {/* Arrow */}
              <div className="mt-4 flex items-center gap-2 text-white font-bold text-xl group-hover:gap-4 transition-all">
                <span>Accedi</span>
                <span className="text-2xl">→</span>
              </div>
            </div>
          </button>

          {/* Card Staff */}
          <button
            onClick={() => router.push('/login')}
            className="group bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl border-4 border-white/20 hover:border-white/40 transition-all hover:scale-105 hover:shadow-cyan-500/50 focus:outline-none focus:ring-4 focus:ring-white/50"
          >
            <div className="flex flex-col items-center gap-6">
              {/* Icon */}
              <div className="w-28 h-28 md:w-32 md:h-32 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:shadow-cyan-400/50 transition-all">
                <Stethoscope className="w-16 h-16 md:w-20 md:h-20 text-white" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
                  Sono dello Staff
                </h2>
                <p className="text-lg md:text-xl text-teal-100 font-medium">
                  Personale sanitario autorizzato
                </p>
              </div>

              {/* Features */}
              <div className="space-y-2 text-white/90 text-base md:text-lg">
                <p>• Gestione pazienti</p>
                <p>• Analisi dati sanitari</p>
                <p>• Dispositivi medici</p>
                <p>• Report e statistiche</p>
              </div>

              {/* Arrow */}
              <div className="mt-4 flex items-center gap-2 text-white font-bold text-xl group-hover:gap-4 transition-all">
                <span>Accedi</span>
                <span className="text-2xl">→</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-white/70 text-sm md:text-base">
          <p>Sistema di monitoraggio sanitario LINKTOP v1.0</p>
          <p className="mt-2">Per assistenza contattare il supporto tecnico</p>
        </div>
      </div>
    </div>
  )
}
