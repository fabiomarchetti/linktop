'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ArrowLeft } from 'lucide-react'

interface Utente {
  id: number
  nome: string
}

export default function UtenteOtoscopioPage() {
  const router = useRouter()
  const [utente, setUtente] = useState<Utente | null>(null)

  // Load user data + fullscreen automatico su smartphone
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const utenteData = localStorage.getItem('linktop_utente')
      if (!utenteData) {
        router.push('/utente')
        return
      }
      setUtente(JSON.parse(utenteData))

      // Fullscreen automatico su smartphone (< 640px)
      const isSmartphone = window.innerWidth < 640
      if (isSmartphone && !document.fullscreenElement) {
        const requestFullscreen = async () => {
          try {
            await document.documentElement.requestFullscreen()
          } catch (err) {
            // Alcuni browser richiedono interazione utente
          }
        }
        requestFullscreen()
      }
    }
  }, [router])

  if (!utente) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center">
        <div className="text-white text-2xl">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-700 to-red-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/utente/home')}
            className="p-4 bg-white/20 backdrop-blur-lg rounded-full shadow-lg hover:bg-white/30 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>

          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
            <Eye className="w-10 h-10" />
            Otoscopio
          </h1>

          <div className="w-14"></div>
        </div>

        {/* Main Content */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-4 border-white/20 shadow-2xl text-center">
          <div className="w-32 h-32 mx-auto bg-amber-500/30 rounded-full flex items-center justify-center mb-6">
            <Eye className="w-16 h-16 text-white" />
          </div>

          <h2 className="text-white text-3xl font-bold mb-4">Otoscopio Digitale</h2>
          <p className="text-white/80 text-xl mb-8">
            Utilizza il tuo dispositivo otoscopio per l'ispezione dell'orecchio.
          </p>

          <div className="bg-white/10 rounded-2xl p-6 mb-6">
            <p className="text-white text-lg">
              Inserisci delicatamente l'otoscopio nel canale auricolare e cattura l'immagine.
            </p>
          </div>

          <div className="space-y-4 text-left">
            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-bold text-xl mb-2">🔦 Illuminazione</h3>
              <p className="text-white/80">Assicurati che la luce sia accesa</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-bold text-xl mb-2">👂 Posizione</h3>
              <p className="text-white/80">Inserisci delicatamente senza forzare</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-bold text-xl mb-2">📸 Foto</h3>
              <p className="text-white/80">Premi il pulsante per catturare l'immagine</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-bold text-xl mb-2">📤 Invio</h3>
              <p className="text-white/80">Le immagini vengono inviate al medico automaticamente</p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push('/utente/home')}
          className="mt-8 w-full py-5 bg-white/20 backdrop-blur-lg text-white rounded-2xl font-bold text-2xl shadow-lg hover:bg-white/30 transition-all"
        >
          Torna alla Home
        </button>
      </div>
    </div>
  )
}
