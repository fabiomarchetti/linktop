'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Users, UserPlus, Edit2, Trash2, Check, X,
  RefreshCw, Search, AlertTriangle, ChevronDown, ChevronUp,
  Heart, Activity, Thermometer, Droplet, Stethoscope, Eye, Calculator
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { calcolaCodiceFiscale, getComuniDisponibili } from '@/lib/codiceFiscale'

interface Paziente {
  id: number
  nome: string
  cognome: string
  data_nascita: string | null
  luogo_nascita: string | null
  codice_fiscale: string | null
  password: string | null
  sesso: 'M' | 'F' | 'A' | null
  telefono: string | null
  email: string | null
  indirizzo: string | null
  citta: string | null
  provincia: string | null
  cap: string | null
  emergenza_nome: string | null
  emergenza_telefono: string | null
  emergenza_relazione: string | null
  emergenza2_nome: string | null
  emergenza2_telefono: string | null
  emergenza2_relazione: string | null
  gruppo_sanguigno: string | null
  allergie: string | null
  patologie: string | null
  farmaci: string | null
  note_mediche: string | null
  last_heart_rate: number | null
  last_heart_rate_time: string | null
  last_systolic_bp: number | null
  last_diastolic_bp: number | null
  last_bp_time: string | null
  last_spo2: number | null
  last_spo2_time: string | null
  last_temperature: number | null
  last_temperature_time: string | null
  last_otoscope_notes: string | null
  last_otoscope_time: string | null
  device_id: number | null
  foto_url: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export default function PazientiPage() {
  const [pazienti, setPazienti] = useState<Paziente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingPaziente, setEditingPaziente] = useState<Paziente | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [expandedPaziente, setExpandedPaziente] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    data_nascita: '',
    luogo_nascita: '',
    codice_fiscale: '',
    password: '',
    sesso: 'M' as 'M' | 'F' | 'A',
    telefono: '',
    email: '',
    indirizzo: '',
    citta: '',
    provincia: '',
    cap: '',
    emergenza_nome: '',
    emergenza_telefono: '',
    emergenza_relazione: '',
    emergenza2_nome: '',
    emergenza2_telefono: '',
    emergenza2_relazione: '',
    gruppo_sanguigno: '',
    allergie: '',
    patologie: '',
    farmaci: '',
    note_mediche: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchPazienti = async () => {
    try {
      const response = await fetch('/api/pazienti')
      const data = await response.json()
      if (data.success) {
        setPazienti(data.pazienti)
      }
    } catch (error) {
      console.error('Errore caricamento pazienti:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPazienti()
  }, [])

  const handleEdit = (paziente: Paziente) => {
    setEditingPaziente(paziente)
    setIsCreating(false)
    setFormData({
      nome: paziente.nome,
      cognome: paziente.cognome,
      data_nascita: paziente.data_nascita || '',
      luogo_nascita: paziente.luogo_nascita || '',
      codice_fiscale: paziente.codice_fiscale || '',
      password: paziente.password || '',
      sesso: paziente.sesso || 'M',
      telefono: paziente.telefono || '',
      email: paziente.email || '',
      indirizzo: paziente.indirizzo || '',
      citta: paziente.citta || '',
      provincia: paziente.provincia || '',
      cap: paziente.cap || '',
      emergenza_nome: paziente.emergenza_nome || '',
      emergenza_telefono: paziente.emergenza_telefono || '',
      emergenza_relazione: paziente.emergenza_relazione || '',
      emergenza2_nome: paziente.emergenza2_nome || '',
      emergenza2_telefono: paziente.emergenza2_telefono || '',
      emergenza2_relazione: paziente.emergenza2_relazione || '',
      gruppo_sanguigno: paziente.gruppo_sanguigno || '',
      allergie: paziente.allergie || '',
      patologie: paziente.patologie || '',
      farmaci: paziente.farmaci || '',
      note_mediche: paziente.note_mediche || ''
    })
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingPaziente(null)
    setFormData({
      nome: '',
      cognome: '',
      data_nascita: '',
      luogo_nascita: '',
      codice_fiscale: '',
      password: '',
      sesso: 'M',
      telefono: '',
      email: '',
      indirizzo: '',
      citta: '',
      provincia: '',
      cap: '',
      emergenza_nome: '',
      emergenza_telefono: '',
      emergenza_relazione: '',
      emergenza2_nome: '',
      emergenza2_telefono: '',
      emergenza2_relazione: '',
      gruppo_sanguigno: '',
      allergie: '',
      patologie: '',
      farmaci: '',
      note_mediche: ''
    })
  }

  const handleCalcolaCodiceFiscale = () => {
    if (!formData.nome || !formData.cognome || !formData.data_nascita || !formData.sesso || !formData.luogo_nascita) {
      setMessage({ type: 'error', text: 'Compila nome, cognome, data nascita, sesso e luogo nascita per calcolare il CF' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    const cf = calcolaCodiceFiscale({
      nome: formData.nome,
      cognome: formData.cognome,
      dataNascita: formData.data_nascita,
      sesso: formData.sesso as 'M' | 'F',
      luogoNascita: formData.luogo_nascita
    })

    if (cf) {
      // Calcola anche la password dalle prime 6 lettere minuscole del CF
      const password = cf.substring(0, 6).toLowerCase()
      setFormData({ ...formData, codice_fiscale: cf, password: password })
      setMessage({ type: 'success', text: 'Codice fiscale e password calcolati!' })
      setTimeout(() => setMessage(null), 2000)
    }
  }

  const handleSave = async () => {
    if (!formData.nome || !formData.cognome) {
      setMessage({ type: 'error', text: 'Nome e cognome sono obbligatori' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setSaving(true)
    try {
      const url = isCreating ? '/api/pazienti' : `/api/pazienti/${editingPaziente?.id}`
      const method = isCreating ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: isCreating ? 'Paziente creato con successo' : 'Paziente aggiornato con successo' })
        setEditingPaziente(null)
        setIsCreating(false)
        fetchPazienti()
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore operazione' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' })
    } finally {
      setSaving(false)
    }

    setTimeout(() => setMessage(null), 3000)
  }

  const handleDelete = async (pazienteId: number) => {
    try {
      const response = await fetch(`/api/pazienti/${pazienteId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Paziente eliminato' })
        fetchPazienti()
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore eliminazione' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' })
    }

    setDeleteConfirm(null)
    setTimeout(() => setMessage(null), 3000)
  }

  const filteredPazienti = pazienti.filter(paz =>
    paz.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paz.cognome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (paz.codice_fiscale && paz.codice_fiscale.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const calculateAge = (dataNascita: string | null): number | null => {
    if (!dataNascita) return null
    const today = new Date()
    const birthDate = new Date(dataNascita)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getSessoLabel = (sesso: string | null) => {
    if (sesso === 'M') return '♂ M'
    if (sesso === 'F') return '♀ F'
    return '⚪ A'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <Sidebar />

      <main className="ml-64 transition-all duration-300">
        <header className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-lg transition-all">
                <ArrowLeft className="w-6 h-6 text-white" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Users className="w-8 h-8" />
                  Gestione Pazienti
                </h1>
                <p className="text-gray-300 mt-1">{pazienti.length} pazienti registrati</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca pazienti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={fetchPazienti}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
              >
                <UserPlus className="w-4 h-4" />
                Nuovo Paziente
              </button>
            </div>
          </div>
        </header>

        <div className="relative z-10 p-8">
          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}>
              {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {message.text}
            </div>
          )}

          {/* Patients Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
              <p className="text-white text-lg">Caricamento pazienti...</p>
            </div>
          ) : filteredPazienti.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="w-16 h-16 text-gray-500 mb-4" />
              <p className="text-white text-lg">Nessun paziente trovato</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPazienti.map((paziente) => (
                <div key={paziente.id} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all hover:bg-white/10">
                  {/* Card Header */}
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {paziente.nome.charAt(0)}{paziente.cognome.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg">
                            {paziente.nome} {paziente.cognome}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-300">
                            <span>{getSessoLabel(paziente.sesso)}</span>
                            {paziente.data_nascita && (
                              <span>• {calculateAge(paziente.data_nascita)} anni</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(paziente)}
                          className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all"
                          title="Modifica"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirm === paziente.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(paziente.id)}
                              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                              title="Conferma"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all"
                              title="Annulla"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(paziente.id)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Info Essenziali */}
                    <div className="space-y-2 text-sm">
                      {paziente.telefono && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <span className="text-gray-400">📞</span>
                          {paziente.telefono}
                        </div>
                      )}
                      {paziente.emergenza_nome && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <span className="text-red-400">🚨</span>
                          {paziente.emergenza_nome} ({paziente.emergenza_relazione})
                        </div>
                      )}
                      {paziente.gruppo_sanguigno && (
                        <div className="flex items-center gap-2">
                          <Droplet className="w-4 h-4 text-red-400" />
                          <span className="text-white font-semibold">{paziente.gruppo_sanguigno}</span>
                        </div>
                      )}
                    </div>

                    {/* Parametri Salute */}
                    {(paziente.last_heart_rate || paziente.last_systolic_bp || paziente.last_spo2 || paziente.last_temperature) && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-gray-400 mb-2">Ultimi parametri:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {paziente.last_heart_rate && (
                            <div className="flex items-center gap-2 text-sm">
                              <Heart className="w-4 h-4 text-red-400" />
                              <span className="text-white">{paziente.last_heart_rate} BPM</span>
                            </div>
                          )}
                          {paziente.last_systolic_bp && paziente.last_diastolic_bp && (
                            <div className="flex items-center gap-2 text-sm">
                              <Activity className="w-4 h-4 text-blue-400" />
                              <span className="text-white">{paziente.last_systolic_bp}/{paziente.last_diastolic_bp}</span>
                            </div>
                          )}
                          {paziente.last_spo2 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Droplet className="w-4 h-4 text-cyan-400" />
                              <span className="text-white">{paziente.last_spo2}%</span>
                            </div>
                          )}
                          {paziente.last_temperature && (
                            <div className="flex items-center gap-2 text-sm">
                              <Thermometer className="w-4 h-4 text-orange-400" />
                              <span className="text-white">{paziente.last_temperature}°C</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expandable Medical Info */}
                  {(paziente.allergie || paziente.patologie || paziente.farmaci || paziente.note_mediche) && (
                    <div className="border-t border-white/10">
                      <button
                        onClick={() => setExpandedPaziente(expandedPaziente === paziente.id ? null : paziente.id)}
                        className="w-full p-4 flex items-center justify-between text-gray-300 hover:bg-white/5 transition-all"
                      >
                        <span className="text-sm font-semibold">Informazioni Mediche</span>
                        {expandedPaziente === paziente.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {expandedPaziente === paziente.id && (
                        <div className="px-4 pb-4 space-y-3 text-sm">
                          {paziente.allergie && (
                            <div>
                              <p className="text-red-400 font-semibold mb-1">🔴 Allergie:</p>
                              <p className="text-gray-300">{paziente.allergie}</p>
                            </div>
                          )}
                          {paziente.patologie && (
                            <div>
                              <p className="text-orange-400 font-semibold mb-1">⚠️ Patologie:</p>
                              <p className="text-gray-300">{paziente.patologie}</p>
                            </div>
                          )}
                          {paziente.farmaci && (
                            <div>
                              <p className="text-blue-400 font-semibold mb-1">💊 Farmaci:</p>
                              <p className="text-gray-300">{paziente.farmaci}</p>
                            </div>
                          )}
                          {paziente.note_mediche && (
                            <div>
                              <p className="text-gray-400 font-semibold mb-1">📋 Note:</p>
                              <p className="text-gray-300">{paziente.note_mediche}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit/Create Modal */}
        {(editingPaziente || isCreating) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-slate-900 border-b border-emerald-500/20 p-6 z-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {isCreating ? <UserPlus className="w-6 h-6 text-emerald-400" /> : <Edit2 className="w-6 h-6 text-emerald-400" />}
                  {isCreating ? 'Nuovo Paziente' : 'Modifica Paziente'}
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Dati Anagrafici */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-emerald-400 border-b border-emerald-500/30 pb-2">
                    Dati Anagrafici
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Nome *</label>
                      <input
                        type="text"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Cognome *</label>
                      <input
                        type="text"
                        value={formData.cognome}
                        onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Data di Nascita</label>
                      <input
                        type="date"
                        value={formData.data_nascita}
                        onChange={(e) => setFormData({ ...formData, data_nascita: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Luogo di Nascita</label>
                      <input
                        type="text"
                        value={formData.luogo_nascita}
                        onChange={(e) => setFormData({ ...formData, luogo_nascita: e.target.value })}
                        list="comuni-list"
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                        placeholder="Inizia a digitare il comune..."
                      />
                      <datalist id="comuni-list">
                        {getComuniDisponibili().map((comune) => (
                          <option key={comune} value={comune} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Codice Fiscale</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.codice_fiscale}
                          onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value.toUpperCase() })}
                          maxLength={16}
                          className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500 uppercase"
                          placeholder="RSSMRA80A01H501X"
                        />
                        <button
                          type="button"
                          onClick={handleCalcolaCodiceFiscale}
                          className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-lg transition-all flex items-center gap-1"
                          title="Calcola automaticamente"
                        >
                          <Calculator className="w-4 h-4" />
                          Calcola
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Password</label>
                      <input
                        type="text"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value.toLowerCase() })}
                        maxLength={100}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500 lowercase"
                        placeholder="Prime 6 lettere del CF (auto-calcolata)"
                        readOnly={!!formData.codice_fiscale}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Si genera automaticamente dalle prime 6 lettere minuscole del codice fiscale
                      </p>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Sesso</label>
                      <select
                        value={formData.sesso}
                        onChange={(e) => setFormData({ ...formData, sesso: e.target.value as 'M' | 'F' | 'A' })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="M" className="bg-slate-900">Maschio</option>
                        <option value="F" className="bg-slate-900">Femmina</option>
                        <option value="A" className="bg-slate-900">Altro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Gruppo Sanguigno</label>
                      <select
                        value={formData.gruppo_sanguigno}
                        onChange={(e) => setFormData({ ...formData, gruppo_sanguigno: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="" className="bg-slate-900">Non specificato</option>
                        <option value="A+" className="bg-slate-900">A+</option>
                        <option value="A-" className="bg-slate-900">A-</option>
                        <option value="B+" className="bg-slate-900">B+</option>
                        <option value="B-" className="bg-slate-900">B-</option>
                        <option value="AB+" className="bg-slate-900">AB+</option>
                        <option value="AB-" className="bg-slate-900">AB-</option>
                        <option value="0+" className="bg-slate-900">0+</option>
                        <option value="0-" className="bg-slate-900">0-</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contatti */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-emerald-400 border-b border-emerald-500/30 pb-2">
                    Contatti
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Telefono</label>
                      <input
                        type="tel"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Residenza */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-emerald-400 border-b border-emerald-500/30 pb-2">
                    Residenza
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-gray-400 text-sm mb-1">Indirizzo</label>
                      <input
                        type="text"
                        value={formData.indirizzo}
                        onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Città</label>
                      <input
                        type="text"
                        value={formData.citta}
                        onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Provincia</label>
                      <input
                        type="text"
                        value={formData.provincia}
                        onChange={(e) => setFormData({ ...formData, provincia: e.target.value.toUpperCase() })}
                        maxLength={2}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">CAP</label>
                      <input
                        type="text"
                        value={formData.cap}
                        onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                        maxLength={5}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contatti Emergenza */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-red-400 border-b border-red-500/30 pb-2">
                    Contatti Emergenza
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Nome Contatto</label>
                        <input
                          type="text"
                          value={formData.emergenza_nome}
                          onChange={(e) => setFormData({ ...formData, emergenza_nome: e.target.value })}
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Telefono</label>
                        <input
                          type="tel"
                          value={formData.emergenza_telefono}
                          onChange={(e) => setFormData({ ...formData, emergenza_telefono: e.target.value })}
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Relazione</label>
                        <input
                          type="text"
                          value={formData.emergenza_relazione}
                          onChange={(e) => setFormData({ ...formData, emergenza_relazione: e.target.value })}
                          placeholder="es. Figlio, Coniuge"
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">Contatto Secondario (opzionale)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <input
                          type="text"
                          value={formData.emergenza2_nome}
                          onChange={(e) => setFormData({ ...formData, emergenza2_nome: e.target.value })}
                          placeholder="Nome"
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="tel"
                          value={formData.emergenza2_telefono}
                          onChange={(e) => setFormData({ ...formData, emergenza2_telefono: e.target.value })}
                          placeholder="Telefono"
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.emergenza2_relazione}
                          onChange={(e) => setFormData({ ...formData, emergenza2_relazione: e.target.value })}
                          placeholder="Relazione"
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informazioni Mediche */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-emerald-400 border-b border-emerald-500/30 pb-2">
                    Informazioni Mediche
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Allergie</label>
                      <textarea
                        value={formData.allergie}
                        onChange={(e) => setFormData({ ...formData, allergie: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Patologie</label>
                      <textarea
                        value={formData.patologie}
                        onChange={(e) => setFormData({ ...formData, patologie: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Farmaci in uso</label>
                      <textarea
                        value={formData.farmaci}
                        onChange={(e) => setFormData({ ...formData, farmaci: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Note Mediche</label>
                      <textarea
                        value={formData.note_mediche}
                        onChange={(e) => setFormData({ ...formData, note_mediche: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-900 border-t border-emerald-500/20 p-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditingPaziente(null)
                    setIsCreating(false)
                  }}
                  className="px-6 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isCreating ? 'Crea Paziente' : 'Salva Modifiche'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
