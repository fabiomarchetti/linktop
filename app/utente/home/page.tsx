'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Stethoscope, Eye, LogOut, Settings, Download } from 'lucide-react'

interface Utente {
  id: number
  nome: string
  cognome: string
  codice_fiscale: string
}

export default function UtenteHomePage() {
  const router = useRouter()
  const [utente, setUtente] = useState<Utente | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Verifica autenticazione
    if (typeof window !== 'undefined') {
      const utenteData = sessionStorage.getItem('linktop_utente')
      if (!utenteData) {
        router.push('/utente')
        return
      }
      setUtente(JSON.parse(utenteData))
    }
  }, [router])

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Registra service worker per PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err)
      })
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('linktop_utente')
      router.push('/utente')
    }
  }

  if (!utente) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center">
        <div className="text-white text-2xl">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800 overflow-hidden relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-3 sm:p-4">
        {/* User Info + Settings */}
        <div className="flex gap-2 items-center">
          <div className="bg-white/20 backdrop-blur-lg rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-lg">
            <p className="text-white font-bold text-sm sm:text-lg">{utente.nome} {utente.cognome}</p>
          </div>
          <button
            onClick={() => router.push('/utente/cambio-password')}
            className="p-2.5 sm:p-3 bg-white/20 backdrop-blur-lg rounded-full shadow-lg hover:bg-white/30 transition-all"
            title="Cambia Password"
          >
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2.5 sm:p-3 bg-red-500/80 backdrop-blur-lg rounded-full shadow-lg hover:bg-red-600 transition-all"
          title="Esci"
        >
          <LogOut className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </button>
      </div>

      {/* Grid Layout - 2x2 ottimizzato per tutte le dimensioni */}
      <div className="h-full w-full px-3 sm:px-4 pt-16 sm:pt-20 pb-3 sm:pb-4 flex flex-col gap-3 sm:gap-4">
        {/* Prima riga */}
        <div className="flex-1 flex gap-3 sm:gap-4">
          {/* 1 - Heart Monitor */}
          <button
            onClick={() => router.push('/utente/dispositivi/heart-monitor')}
            className="flex-1 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl sm:rounded-3xl shadow-2xl hover:shadow-red-500/50 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2 sm:gap-3 text-white border-2 border-white/30"
          >
            <span className="text-6xl sm:text-7xl lg:text-8xl font-black drop-shadow-lg">1</span>
            <Heart className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 drop-shadow-lg" />
            <div className="text-center px-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold block">Heart Monitor</span>
              <span className="text-sm sm:text-base lg:text-lg opacity-90">Pressione - Battito - Ossigeno</span>
            </div>
          </button>

          {/* 2 - Stetoscopio */}
          <button
            onClick={() => router.push('/utente/dispositivi/stetoscopio')}
            className="flex-1 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl sm:rounded-3xl shadow-2xl hover:shadow-blue-500/50 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2 sm:gap-3 text-white border-2 border-white/30"
          >
            <span className="text-6xl sm:text-7xl lg:text-8xl font-black drop-shadow-lg">2</span>
            <Stethoscope className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 drop-shadow-lg" />
            <div className="text-center px-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold block">Stetoscopio</span>
              <span className="text-sm sm:text-base lg:text-lg opacity-90">Auscultazione</span>
            </div>
          </button>
        </div>

        {/* Seconda riga */}
        <div className="flex-1 flex gap-3 sm:gap-4">
          {/* 3 - Placeholder */}
          <button
            disabled
            className="flex-1 bg-gradient-to-br from-gray-400/50 to-gray-500/50 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col items-center justify-center gap-2 sm:gap-3 text-white/50 border-2 border-white/10 cursor-not-allowed"
          >
            <span className="text-6xl sm:text-7xl lg:text-8xl font-black">3</span>
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-3xl sm:text-4xl">?</span>
            </div>
            <div className="text-center px-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold block">Prossimamente</span>
            </div>
          </button>

          {/* 4 - Otoscopio */}
          <button
            onClick={() => router.push('/utente/dispositivi/otoscopio')}
            className="flex-1 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl sm:rounded-3xl shadow-2xl hover:shadow-amber-500/50 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2 sm:gap-3 text-white border-2 border-white/30"
          >
            <span className="text-6xl sm:text-7xl lg:text-8xl font-black drop-shadow-lg">4</span>
            <Eye className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 drop-shadow-lg" />
            <div className="text-center px-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold block">Otoscopio</span>
              <span className="text-sm sm:text-base lg:text-lg opacity-90">Ispezione Orecchio</span>
            </div>
          </button>
        </div>
      </div>

      {/* Install PWA Button */}
      {deferredPrompt && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-5 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl sm:rounded-2xl border-2 border-white shadow-2xl hover:shadow-emerald-500/50 transition-all hover:scale-105 font-bold text-base sm:text-lg"
          >
            <Download className="w-5 h-5 sm:w-6 sm:h-6" />
            Installa App
          </button>
        </div>
      )}
    </div>
  )
}
