'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'

interface Ruolo {
  id: number
  nome: string
  descrizione: string
  livello: number
}

export default function RegisterPage() {
  const [ruoli, setRuoli] = useState<Ruolo[]>([])
  const [loadingRuoli, setLoadingRuoli] = useState(true)
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    ruolo_nome: 'utente_base',
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  // Carica i ruoli dal database
  useEffect(() => {
    const fetchRuoli = async () => {
      try {
        const response = await fetch('/api/ruoli')
        const data = await response.json()
        setRuoli(data.ruoli)
      } catch (err) {
        console.error('Errore caricamento ruoli:', err)
      } finally {
        setLoadingRuoli(false)
      }
    }
    fetchRuoli()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validazione
    if (!formData.nome || !formData.cognome || !formData.username || !formData.password) {
      setError('Compila tutti i campi obbligatori')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Le password non corrispondono')
      return
    }

    if (formData.password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: formData.nome,
          cognome: formData.cognome,
          ruolo_nome: formData.ruolo_nome,
          username: formData.username,
          password: formData.password,
          email: formData.email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la registrazione')
      }

      setSuccess(true)
      setFormData({
        nome: '',
        cognome: '',
        ruolo_nome: 'utente_base',
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const getRuoloIcon = (nome: string) => {
    switch (nome) {
      case 'sviluppatore': return '🔧'
      case 'animatore_digitale': return '💻'
      case 'assistente_control': return '📊'
      case 'controllo_parentale': return '👨‍👩‍👧'
      case 'utente_base': return '👤'
      default: return '👤'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-4 relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-lg rounded-full mb-4 shadow-2xl border border-white/30">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">Registrazione</h1>
          <p className="text-emerald-100 text-lg">LINKTOP Health Monitor</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/50">
          {success && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-lg">
              <p className="text-green-800 font-bold text-lg">✓ Registrazione completata!</p>
              <p className="text-green-700 text-sm mt-2">
                <Link href="/dashboard/users" className="font-semibold underline hover:text-green-900 transition-colors">
                  → Torna alla gestione staff
                </Link>
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-xl shadow-lg">
              <p className="text-red-800 font-semibold">✗ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                required
              />
            </div>

            {/* Cognome */}
            <div>
              <label htmlFor="cognome" className="block text-sm font-medium text-gray-700 mb-1">
                Cognome *
              </label>
              <input
                type="text"
                id="cognome"
                name="cognome"
                value={formData.cognome}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                required
              />
            </div>

            {/* Ruolo */}
            <div>
              <label htmlFor="ruolo_nome" className="block text-sm font-medium text-gray-700 mb-1">
                Ruolo *
              </label>
              {loadingRuoli ? (
                <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500">
                  Caricamento ruoli...
                </div>
              ) : (
                <select
                  id="ruolo_nome"
                  name="ruolo_nome"
                  value={formData.ruolo_nome}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                  required
                >
                  {ruoli.map((ruolo) => (
                    <option key={ruolo.id} value={ruolo.nome}>
                      {getRuoloIcon(ruolo.nome)} {ruolo.descrizione}
                    </option>
                  ))}
                </select>
              )}
              {formData.ruolo_nome && !loadingRuoli && (
                <p className="mt-2 text-sm text-gray-600">
                  {ruoli.find(r => r.nome === formData.ruolo_nome)?.descrizione}
                </p>
              )}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email (opzionale)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password * (min 8 caratteri)
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                minLength={8}
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Conferma Password *
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                minLength={8}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? '⏳ Registrazione in corso...' : '✓ Registrati'}
            </button>
          </form>

          {/* Link to Login */}
          <div className="mt-6 text-center">
            <p className="text-gray-700">
              Hai già un account?{' '}
              <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-bold underline transition-colors">
                Accedi ora
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-6 text-center">
          <Link href="/dashboard/users" className="text-white/90 hover:text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            <span>←</span> Torna alla gestione staff
          </Link>
        </div>
      </div>
    </div>
  )
}
