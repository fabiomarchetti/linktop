'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Stethoscope, Eye, LogOut, Mic, Volume2 } from 'lucide-react'

interface Utente {
  id: number
  nome: string
  cognome: string
  codice_fiscale: string
}

export default function UtenteHomePage() {
  const router = useRouter()
  const [utente, setUtente] = useState<Utente | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<any>(null)

  useEffect(() => {
    // Verifica autenticazione
    if (typeof window !== 'undefined') {
      const utenteData = sessionStorage.getItem('linktop_utente')
      if (!utenteData) {
        router.push('/utente')
        return
      }
      setUtente(JSON.parse(utenteData))

      // Inizializza Web Speech API
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'it-IT'

        recognitionRef.current.onresult = (event: any) => {
          const text = event.results[0][0].transcript.toLowerCase()
          setTranscript(text)
          handleVoiceCommand(text)
        }

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }
      }

      // Inizializza sintesi vocale
      if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [router])

  const speak = (text: string) => {
    if (synthRef.current) {
      // Cancella queue precedente
      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'it-IT'
      utterance.rate = 0.9 // Velocità leggermente ridotta per anziani
      utterance.pitch = 1.0
      utterance.volume = 1.0

      synthRef.current.speak(utterance)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  }

  const handleCentralButtonClick = () => {
    if (!utente) return

    const greeting = `${getGreeting()} ${utente.nome}. Cosa vuoi fare oggi?`
    speak(greeting)

    // Inizia l'ascolto dopo aver parlato
    setTimeout(() => {
      startListening()
    }, 3000)
  }

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        setTranscript('')
        recognitionRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error('Error starting recognition:', error)
      }
    }
  }

  const handleVoiceCommand = (text: string) => {
    console.log('Voice command:', text)

    // Heart Monitor: pressione, temperatura, ossigeno, battito
    if (
      text.includes('pressione') ||
      text.includes('temperatura') ||
      text.includes('ossigeno') ||
      text.includes('battito')
    ) {
      speak('Ti porto al monitor cardiaco')
      setTimeout(() => {
        router.push('/utente/dispositivi/heart-monitor')
      }, 1500)
      return
    }

    // Stetoscopio: cuore, auscultazione, polmoni
    if (
      text.includes('stetoscopio') ||
      text.includes('auscultazione') ||
      text.includes('polmoni')
    ) {
      speak('Ti porto allo stetoscopio')
      setTimeout(() => {
        router.push('/utente/dispositivi/stetoscopio')
      }, 1500)
      return
    }

    // Otoscopio: immagine, orecchio, foto
    if (
      text.includes('immagine') ||
      text.includes('orecchio') ||
      text.includes('foto') ||
      text.includes('otoscopio')
    ) {
      speak('Ti porto all otoscopio')
      setTimeout(() => {
        router.push('/utente/dispositivi/otoscopio')
      }, 1500)
      return
    }

    // Non riconosciuto
    speak('Non ho capito. Riprova dicendo: pressione, cuore, o immagine')
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
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800 overflow-hidden relative">
      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 z-50 p-4 bg-red-500/80 backdrop-blur-lg rounded-full shadow-lg hover:bg-red-600 transition-all"
        title="Esci"
      >
        <LogOut className="w-6 h-6 text-white" />
      </button>

      {/* User Info */}
      <div className="absolute top-4 left-4 z-50 bg-white/20 backdrop-blur-lg rounded-2xl px-6 py-3 shadow-lg">
        <p className="text-white font-bold text-xl">{utente.nome} {utente.cognome}</p>
      </div>

      {/* Grid Layout - 2x2 con bottone centrale sovrapposto */}
      <div className="h-screen w-screen p-4 flex flex-col gap-4">
        {/* Prima riga */}
        <div className="flex-1 flex gap-4">
          {/* Heart Monitor */}
          <button
            onClick={() => router.push('/utente/dispositivi/heart-monitor')}
            className="flex-1 bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl shadow-2xl hover:shadow-red-500/50 transition-all hover:scale-105 flex flex-col items-center justify-center gap-4 text-white border-4 border-white/20"
          >
            <Heart className="w-20 h-20 md:w-24 md:h-24" />
            <span className="text-2xl md:text-3xl font-bold">Heart Monitor</span>
            <span className="text-lg md:text-xl opacity-90">Pressione • Battito • Ossigeno</span>
          </button>

          {/* Stetoscopio */}
          <button
            onClick={() => router.push('/utente/dispositivi/stetoscopio')}
            className="flex-1 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-3xl shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105 flex flex-col items-center justify-center gap-4 text-white border-4 border-white/20"
          >
            <Stethoscope className="w-20 h-20 md:w-24 md:h-24" />
            <span className="text-2xl md:text-3xl font-bold">Stetoscopio</span>
            <span className="text-lg md:text-xl opacity-90">Auscultazione</span>
          </button>
        </div>

        {/* Seconda riga */}
        <div className="flex-1 flex gap-4">
          {/* Placeholder 3 */}
          <button
            disabled
            className="flex-1 bg-gradient-to-br from-purple-500/40 to-violet-600/40 rounded-3xl shadow-2xl flex flex-col items-center justify-center gap-4 text-white/60 border-4 border-white/10 cursor-not-allowed"
          >
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-3xl">?</span>
            </div>
            <span className="text-2xl md:text-3xl font-bold">Prossimamente</span>
          </button>

          {/* Otoscopio */}
          <button
            onClick={() => router.push('/utente/dispositivi/otoscopio')}
            className="flex-1 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl shadow-2xl hover:shadow-amber-500/50 transition-all hover:scale-105 flex flex-col items-center justify-center gap-4 text-white border-4 border-white/20"
          >
            <Eye className="w-20 h-20 md:w-24 md:h-24" />
            <span className="text-2xl md:text-3xl font-bold">Otoscopio</span>
            <span className="text-lg md:text-xl opacity-90">Ispezione Orecchio</span>
          </button>
        </div>
      </div>

      {/* Bottone Centrale - Sovrapposto */}
      <button
        onClick={handleCentralButtonClick}
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 md:w-48 md:h-48 rounded-full shadow-2xl z-40 transition-all hover:scale-110 flex flex-col items-center justify-center gap-2 ${
          isListening
            ? 'bg-gradient-to-br from-green-400 to-emerald-500 animate-pulse'
            : 'bg-gradient-to-br from-white to-gray-100'
        }`}
        style={{
          boxShadow: isListening
            ? '0 0 50px rgba(16, 185, 129, 0.8), 0 0 100px rgba(16, 185, 129, 0.4)'
            : '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
      >
        {isListening ? (
          <>
            <Mic className="w-16 h-16 md:w-20 md:h-20 text-white animate-bounce" />
            <span className="text-white font-bold text-lg md:text-xl">In ascolto...</span>
          </>
        ) : (
          <>
            <Volume2 className="w-16 h-16 md:w-20 md:h-20 text-emerald-600" />
            <span className="text-emerald-700 font-bold text-xl md:text-2xl text-center px-4">
              Clicca qui
            </span>
          </>
        )}
      </button>

      {/* Transcript Display */}
      {transcript && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-lg rounded-2xl px-8 py-4 shadow-lg max-w-lg z-50">
          <p className="text-gray-800 font-semibold text-lg text-center">
            Hai detto: "{transcript}"
          </p>
        </div>
      )}
    </div>
  )
}
