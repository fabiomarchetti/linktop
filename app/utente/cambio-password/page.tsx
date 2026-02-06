'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface Utente {
  id: number
  nome: string
  cognome: string
  codice_fiscale: string
}

export default function CambioPasswordPage() {
  const router = useRouter()
  const [utente, setUtente] = useState<Utente | null>(null)
  const [formData, setFormData] = useState({
    passwordAttuale: '',
    nuovaPassword: '',
    confermaPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    attuale: false,
    nuova: false,
    conferma: false
  })

  // Verifica autenticazione + fullscreen automatico su smartphone
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const togglePasswordVisibility = (field: 'attuale' | 'nuova' | 'conferma') => {
    setShowPasswords({
      ...showPasswords,
      [field]: !showPasswords[field]
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validazioni
    if (!formData.passwordAttuale || !formData.nuovaPassword || !formData.confermaPassword) {
      setError('Compila tutti i campi')
      return
    }

    if (formData.nuovaPassword.length < 6) {
      setError('La nuova password deve essere di almeno 6 caratteri')
      return
    }

    if (formData.nuovaPassword !== formData.confermaPassword) {
      setError('Le password non corrispondono')
      return
    }

    if (formData.passwordAttuale === formData.nuovaPassword) {
      setError('La nuova password deve essere diversa da quella attuale')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/utente/cambio-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          utente_id: utente?.id,
          password_attuale: formData.passwordAttuale.toLowerCase(),
          nuova_password: formData.nuovaPassword.toLowerCase()
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setFormData({
          passwordAttuale: '',
          nuovaPassword: '',
          confermaPassword: ''
        })

        // Redirect dopo 3 secondi
        setTimeout(() => {
          router.push('/utente/home')
        }, 3000)
      } else {
        setError(data.error || 'Errore durante il cambio password')
      }
    } catch (error) {
      setError('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
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
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800 p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto pt-6 pb-4">
        <button
          onClick={() => router.push('/utente/home')}
          className="flex items-center gap-2 text-white hover:text-teal-100 transition-colors mb-6"
        >
          <ArrowLeft className="w-6 h-6" />
          <span className="text-lg font-semibold">Torna alla home</span>
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Cambio Password
          </h1>
          <p className="text-teal-100 text-lg">
            {utente.nome} {utente.cognome}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 md:p-8">
          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-400/30 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-300 flex-shrink-0" />
              <div>
                <p className="text-green-100 font-semibold text-lg">Password cambiata con successo!</p>
                <p className="text-green-200 text-sm">Verrai reindirizzato alla home...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-300 flex-shrink-0" />
              <p className="text-red-100 font-semibold">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-400/30 rounded-xl">
            <p className="text-blue-100 text-sm leading-relaxed">
              <strong>Nota:</strong> La password predefinita è composta dalle prime 6 lettere del tuo codice fiscale in minuscolo.
              Puoi cambiarla con una password personalizzata di almeno 6 caratteri.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password Attuale */}
            <div>
              <label className="block text-white text-lg font-semibold mb-2">
                Password Attuale
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-teal-300" />
                <input
                  type={showPasswords.attuale ? 'text' : 'password'}
                  name="passwordAttuale"
                  value={formData.passwordAttuale}
                  onChange={handleChange}
                  className="w-full pl-12 pr-12 py-4 text-lg bg-white/20 border-2 border-white/30 rounded-2xl text-white placeholder-white/60 focus:outline-none focus:border-teal-300 focus:bg-white/25 transition-all"
                  placeholder="Password attuale"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('attuale')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-teal-300 hover:text-white transition-colors"
                >
                  {showPasswords.attuale ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Nuova Password */}
            <div>
              <label className="block text-white text-lg font-semibold mb-2">
                Nuova Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-teal-300" />
                <input
                  type={showPasswords.nuova ? 'text' : 'password'}
                  name="nuovaPassword"
                  value={formData.nuovaPassword}
                  onChange={handleChange}
                  className="w-full pl-12 pr-12 py-4 text-lg bg-white/20 border-2 border-white/30 rounded-2xl text-white placeholder-white/60 focus:outline-none focus:border-teal-300 focus:bg-white/25 transition-all"
                  placeholder="Almeno 6 caratteri"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('nuova')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-teal-300 hover:text-white transition-colors"
                >
                  {showPasswords.nuova ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Conferma Password */}
            <div>
              <label className="block text-white text-lg font-semibold mb-2">
                Conferma Nuova Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-teal-300" />
                <input
                  type={showPasswords.conferma ? 'text' : 'password'}
                  name="confermaPassword"
                  value={formData.confermaPassword}
                  onChange={handleChange}
                  className="w-full pl-12 pr-12 py-4 text-lg bg-white/20 border-2 border-white/30 rounded-2xl text-white placeholder-white/60 focus:outline-none focus:border-teal-300 focus:bg-white/25 transition-all"
                  placeholder="Ripeti la nuova password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('conferma')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-teal-300 hover:text-white transition-colors"
                >
                  {showPasswords.conferma ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl hover:from-teal-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : success ? (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Completato
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6" />
                  Cambia Password
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center text-white/80 text-sm">
            <p>La tua password verrà salvata in modo sicuro nel database.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
