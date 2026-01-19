'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Stethoscope, Eye, LogOut, Mic, Volume2, Settings } from 'lucide-react'

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
  const [destinationMessage, setDestinationMessage] = useState('')
  const [micPermissionGranted, setMicPermissionGranted] = useState(false)
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

      // Verifica se permesso microfono già concesso
      const micPermission = localStorage.getItem('linktop_mic_permission')
      if (micPermission === 'granted') {
        setMicPermissionGranted(true)
      }

      // Inizializza Web Speech API
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'it-IT'

        recognitionRef.current.onresult = (event: any) => {
          const text = event.results[0][0].transcript.toLowerCase()
          console.log('🎤 Riconosciuto:', text)
          setTranscript(text)
          handleVoiceCommand(text)
        }

        recognitionRef.current.onerror = (event: any) => {
          console.error('❌ Speech recognition error:', event.error)
          alert(`❌ Errore microfono: ${event.error}`)
          setIsListening(false)
        }

        recognitionRef.current.onend = () => {
          console.log('🛑 Speech recognition ended')
          setIsListening(false)
        }

        recognitionRef.current.onstart = () => {
          console.log('🎤 Speech recognition started')
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

  const requestMicPermission = async () => {
    try {
      console.log('🎤 Requesting microphone permission...')

      // NUOVO APPROCCIO: Usa direttamente SpeechRecognition per chiedere permesso
      // Questo bypassa il problema HTTPS di getUserMedia su Android
      if (!recognitionRef.current) {
        alert('❌ Riconoscimento vocale non supportato su questo browser')
        return
      }

      // Salva handler originali
      const originalOnStart = recognitionRef.current.onstart
      const originalOnError = recognitionRef.current.onerror

      // Timeout di sicurezza
      const startTimeout = setTimeout(() => {
        console.log('⏱️ Timeout: permission not granted')
        try {
          recognitionRef.current.stop()
        } catch (e) {}

        // Ripristina handler originali
        recognitionRef.current.onstart = originalOnStart
        recognitionRef.current.onerror = originalOnError

        alert('❌ Timeout: il permesso non è stato concesso. Prova a ricaricare la pagina.')
      }, 3000)

      // Handler temporanei per il test permesso
      recognitionRef.current.onstart = () => {
        clearTimeout(startTimeout)
        console.log('✅ Speech Recognition started - permission granted!')

        // Ferma subito
        try {
          recognitionRef.current.stop()
        } catch (e) {}

        // Ripristina handler originali
        recognitionRef.current.onstart = originalOnStart
        recognitionRef.current.onerror = originalOnError

        // Salva in localStorage
        localStorage.setItem('linktop_mic_permission', 'granted')
        setMicPermissionGranted(true)

        speak('Microfono attivato con successo!')
      }

      recognitionRef.current.onerror = (event: any) => {
        clearTimeout(startTimeout)
        console.error('❌ Speech Recognition error:', event.error)

        // Ripristina handler originali
        recognitionRef.current.onstart = originalOnStart
        recognitionRef.current.onerror = originalOnError

        if (event.error === 'not-allowed') {
          alert(`❌ Permesso negato. Chrome ha bloccato il microfono.\n\nVai su: Chrome Menu → Impostazioni → Impostazioni sito → Microfono → Rimuovi 192.168.0.100 dalla lista bloccati`)
        } else {
          alert(`❌ Errore: ${event.error}`)
        }
      }

      // Prova a fare uno start rapido per triggerare il permesso
      recognitionRef.current.start()

    } catch (error) {
      console.error('❌ Error:', error)
      alert(`❌ Errore imprevisto: ${error}`)
    }
  }

  const handleCentralButtonClick = () => {
    if (!utente) return

    // Controlla se permesso è stato concesso
    if (!micPermissionGranted) {
      speak('Prima devi attivare il microfono con il pulsante in alto')
      return
    }

    // IMPORTANTE: Avvia ascolto SUBITO (per Chrome Android)
    // Il setTimeout blocca il permesso microfono su Android
    startListening()

    const greeting = `${getGreeting()} ${utente.nome}. Cosa vuoi fare oggi? Dimmi: 1, 2, 3, o 4.`
    speak(greeting)
  }

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('🚀 Trying to start recognition...')
        setTranscript('')
        setDestinationMessage('')
        recognitionRef.current.start()
        setIsListening(true)
        console.log('✅ Recognition start() called successfully')
      } catch (error) {
        console.error('💥 Error starting recognition:', error)
        alert(`💥 Errore avvio: ${error}`)
      }
    } else {
      console.log('⚠️ Cannot start: recognitionRef or already listening')
    }
  }

  const handleVoiceCommand = (text: string) => {
    console.log('🔍 Analizzing voice command:', text)

    // Numero 1: Heart Monitor
    if (
      text.includes('1') ||
      text.includes('uno') ||
      text.includes('prima') ||
      text.includes('pressione') ||
      text.includes('temperatura') ||
      text.includes('ossigeno') ||
      text.includes('battito')
    ) {
      console.log('✅ Match: Heart Monitor (1)')
      setDestinationMessage('Monitor Cardiaco')
      speak('Ti porto al monitor cardiaco')
      setTimeout(() => {
        console.log('🚀 Navigating to heart-monitor')
        router.push('/utente/dispositivi/heart-monitor')
      }, 1500)
      return
    }

    // Numero 2: Stetoscopio
    if (
      text.includes('2') ||
      text.includes('due') ||
      text.includes('seconda') ||
      text.includes('stetoscopio') ||
      text.includes('auscultazione') ||
      text.includes('polmoni')
    ) {
      console.log('✅ Match: Stetoscopio (2)')
      setDestinationMessage('Stetoscopio')
      speak('Ti porto allo stetoscopio')
      setTimeout(() => {
        console.log('🚀 Navigating to stetoscopio')
        router.push('/utente/dispositivi/stetoscopio')
      }, 1500)
      return
    }

    // Numero 3: Placeholder (disabilitato)
    if (
      text.includes('3') ||
      text.includes('tre') ||
      text.includes('terza')
    ) {
      console.log('⚠️ Match: Placeholder (3) - Non disponibile')
      setDestinationMessage('Funzione non disponibile')
      speak('Questa funzione non è ancora disponibile')
      return
    }

    // Numero 4: Otoscopio
    if (
      text.includes('4') ||
      text.includes('quattro') ||
      text.includes('quarta') ||
      text.includes('immagine') ||
      text.includes('orecchio') ||
      text.includes('foto') ||
      text.includes('otoscopio')
    ) {
      console.log('✅ Match: Otoscopio (4)')
      setDestinationMessage('Otoscopio')
      speak('Ti porto all otoscopio')
      setTimeout(() => {
        console.log('🚀 Navigating to otoscopio')
        router.push('/utente/dispositivi/otoscopio')
      }, 1500)
      return
    }

    // Non riconosciuto
    console.log('❌ No match found for:', text)
    setDestinationMessage('Comando non riconosciuto')
    speak('Non ho capito. Riprova dicendo: 1, 2, 3, o 4')
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
      {/* Logout Button - Compatto */}
      <button
        onClick={handleLogout}
        className="absolute top-2 right-2 z-50 p-3 bg-red-500/80 backdrop-blur-lg rounded-full shadow-lg hover:bg-red-600 transition-all"
        title="Esci"
      >
        <LogOut className="w-5 h-5 text-white" />
      </button>

      {/* User Info - Compatto */}
      <div className="absolute top-2 left-2 z-50 flex gap-2 items-center">
        <div className="bg-white/20 backdrop-blur-lg rounded-xl px-4 py-2 shadow-lg">
          <p className="text-white font-bold text-base">{utente.nome} {utente.cognome}</p>
        </div>
        <button
          onClick={() => router.push('/utente/cambio-password')}
          className="p-3 bg-white/20 backdrop-blur-lg rounded-full shadow-lg hover:bg-white/30 transition-all"
          title="Cambia Password"
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Pulsante Attiva Microfono (solo se non ancora attivato) */}
      {!micPermissionGranted && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={requestMicPermission}
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl hover:shadow-orange-500/50 transition-all hover:scale-105 flex items-center gap-3 border-4 border-white animate-pulse"
          >
            <Mic className="w-8 h-8" />
            <span className="text-xl font-bold">Attiva Microfono</span>
          </button>
        </div>
      )}

      {/* Indicatore Microfono Attivo (quando concesso) */}
      {micPermissionGranted && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 backdrop-blur-lg rounded-xl px-6 py-2 shadow-lg border-2 border-white">
          <p className="text-white font-bold text-base flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Microfono attivo
          </p>
        </div>
      )}

      {/* Debug: Stato microfono */}
      <div className="absolute top-16 left-2 z-50 bg-black/50 backdrop-blur-lg rounded-lg px-3 py-1 text-xs text-white">
        {isListening ? '🎤 IN ASCOLTO...' : '⏸️ Fermo'}
      </div>

      {/* Grid Layout - 2x2 ultra-compatto per tablet senza scroll */}
      <div className="h-full w-full px-2 py-2 flex flex-col gap-1.5">
        {/* Prima riga */}
        <div className="flex-1 flex gap-1.5 pt-10">
          {/* 1 - Heart Monitor */}
          <button
            onClick={() => router.push('/utente/dispositivi/heart-monitor')}
            className="flex-1 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-2xl hover:shadow-red-500/50 transition-all hover:scale-105 flex flex-col items-center justify-center gap-1 text-white border-2 border-white/20"
          >
            <span className="text-5xl md:text-6xl font-black">1</span>
            <Heart className="w-10 h-10 md:w-12 md:h-12" />
            <span className="text-xl md:text-2xl font-bold">Heart Monitor</span>
            <span className="text-base md:text-lg opacity-90">Pressione • Battito • Ossigeno</span>
          </button>

          {/* 2 - Stetoscopio */}
          <button
            onClick={() => router.push('/utente/dispositivi/stetoscopio')}
            className="flex-1 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105 flex flex-col items-center justify-center gap-1 text-white border-2 border-white/20"
          >
            <span className="text-5xl md:text-6xl font-black">2</span>
            <Stethoscope className="w-10 h-10 md:w-12 md:h-12" />
            <span className="text-xl md:text-2xl font-bold">Stetoscopio</span>
            <span className="text-base md:text-lg opacity-90">Auscultazione</span>
          </button>
        </div>

        {/* Seconda riga */}
        <div className="flex-1 flex gap-1.5 pb-2">
          {/* 3 - Placeholder */}
          <button
            disabled
            className="flex-1 bg-gradient-to-br from-purple-500/40 to-violet-600/40 rounded-xl shadow-2xl flex flex-col items-center justify-center gap-1 text-white/60 border-2 border-white/10 cursor-not-allowed"
          >
            <span className="text-5xl md:text-6xl font-black">3</span>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-2xl">?</span>
            </div>
            <span className="text-xl md:text-2xl font-bold">Prossimamente</span>
          </button>

          {/* 4 - Otoscopio */}
          <button
            onClick={() => router.push('/utente/dispositivi/otoscopio')}
            className="flex-1 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-2xl hover:shadow-amber-500/50 transition-all hover:scale-105 flex flex-col items-center justify-center gap-1 text-white border-2 border-white/20"
          >
            <span className="text-5xl md:text-6xl font-black">4</span>
            <Eye className="w-10 h-10 md:w-12 md:h-12" />
            <span className="text-xl md:text-2xl font-bold">Otoscopio</span>
            <span className="text-base md:text-lg opacity-90">Ispezione Orecchio</span>
          </button>
        </div>
      </div>

      {/* Bottone Centrale - Molto più compatto */}
      <button
        onClick={handleCentralButtonClick}
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 md:w-28 md:h-28 rounded-full shadow-2xl z-40 transition-all hover:scale-110 flex flex-col items-center justify-center gap-0.5 ${
          isListening
            ? 'bg-gradient-to-br from-green-400 to-emerald-500 animate-pulse'
            : 'bg-gradient-to-br from-white to-gray-100'
        }`}
        style={{
          boxShadow: isListening
            ? '0 0 30px rgba(16, 185, 129, 0.8), 0 0 60px rgba(16, 185, 129, 0.4)'
            : '0 10px 35px rgba(0, 0, 0, 0.3)'
        }}
      >
        {isListening ? (
          <>
            <Mic className="w-9 h-9 md:w-10 md:h-10 text-white animate-bounce" />
            <span className="text-white font-bold text-xs">In ascolto...</span>
          </>
        ) : (
          <>
            <Volume2 className="w-9 h-9 md:w-10 md:h-10 text-emerald-600" />
            <span className="text-emerald-700 font-bold text-xs md:text-sm text-center px-1">
              Clicca qui
            </span>
          </>
        )}
      </button>

      {/* Destination Display - Semplice e chiaro */}
      {destinationMessage && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-emerald-600 backdrop-blur-lg rounded-2xl px-12 py-6 shadow-2xl z-50 border-4 border-white">
          <p className="text-white font-black text-4xl text-center flex items-center gap-3">
            → {destinationMessage}
          </p>
        </div>
      )}
    </div>
  )
}
