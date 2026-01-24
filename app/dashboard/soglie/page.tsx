'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  Users,
  Globe,
  User,
  Heart,
  Droplet,
  Thermometer,
  Activity,
  Save,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'

interface AlertRule {
  id: number
  paziente_id: number | null
  parameter_type: string
  min_warning: number | null
  max_warning: number | null
  min_critical: number | null
  max_critical: number | null
  enabled: boolean
  priority: number
}

interface Paziente {
  id: number
  nome: string
  cognome: string
}

interface ThresholdForm {
  min_warning: string
  max_warning: string
  min_critical: string
  max_critical: string
  enabled: boolean
}

const PARAMETERS = [
  {
    type: 'heart_rate',
    label: 'Frequenza Cardiaca',
    unit: 'bpm',
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    description: 'Battiti cardiaci al minuto',
  },
  {
    type: 'spo2',
    label: 'Saturazione O2',
    unit: '%',
    icon: Droplet,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    description: 'Livello di ossigeno nel sangue',
  },
  {
    type: 'systolic_bp',
    label: 'Pressione Sistolica',
    unit: 'mmHg',
    icon: Activity,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    description: 'Pressione massima',
  },
  {
    type: 'diastolic_bp',
    label: 'Pressione Diastolica',
    unit: 'mmHg',
    icon: Activity,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    description: 'Pressione minima',
  },
  {
    type: 'temperature',
    label: 'Temperatura',
    unit: '°C',
    icon: Thermometer,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    description: 'Temperatura corporea',
  },
]

export default function SogliePage() {
  const [pazienti, setPazienti] = useState<Paziente[]>([])
  const [selectedPazienteId, setSelectedPazienteId] = useState<number | null>(null)
  const [globalRules, setGlobalRules] = useState<AlertRule[]>([])
  const [patientRules, setPatientRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state per ogni parametro (globale)
  const [globalForms, setGlobalForms] = useState<Record<string, ThresholdForm>>({})
  // Form state per ogni parametro (paziente)
  const [patientForms, setPatientForms] = useState<Record<string, ThresholdForm>>({})

  // Carica pazienti
  useEffect(() => {
    const fetchPazienti = async () => {
      try {
        const response = await fetch('/api/pazienti')
        const data = await response.json()
        if (data.success) {
          setPazienti(data.pazienti)
        }
      } catch (error) {
        console.error('Errore caricamento pazienti:', error)
      }
    }
    fetchPazienti()
  }, [])

  // Carica regole globali
  useEffect(() => {
    const fetchGlobalRules = async () => {
      try {
        const response = await fetch('/api/alert-rules?include_global=true')
        const data = await response.json()
        if (data.success) {
          setGlobalRules(data.global_rules)
          // Inizializza form
          const forms: Record<string, ThresholdForm> = {}
          data.global_rules.forEach((rule: AlertRule) => {
            forms[rule.parameter_type] = {
              min_warning: rule.min_warning?.toString() || '',
              max_warning: rule.max_warning?.toString() || '',
              min_critical: rule.min_critical?.toString() || '',
              max_critical: rule.max_critical?.toString() || '',
              enabled: rule.enabled,
            }
          })
          setGlobalForms(forms)
        }
      } catch (error) {
        console.error('Errore caricamento regole:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchGlobalRules()
  }, [])

  // Carica regole paziente quando selezionato
  useEffect(() => {
    if (!selectedPazienteId) {
      setPatientRules([])
      setPatientForms({})
      return
    }

    const fetchPatientRules = async () => {
      try {
        const response = await fetch(`/api/alert-rules?paziente_id=${selectedPazienteId}&include_global=false`)
        const data = await response.json()
        if (data.success) {
          setPatientRules(data.patient_rules)
          // Inizializza form paziente
          const forms: Record<string, ThresholdForm> = {}
          data.patient_rules.forEach((rule: AlertRule) => {
            forms[rule.parameter_type] = {
              min_warning: rule.min_warning?.toString() || '',
              max_warning: rule.max_warning?.toString() || '',
              min_critical: rule.min_critical?.toString() || '',
              max_critical: rule.max_critical?.toString() || '',
              enabled: rule.enabled,
            }
          })
          setPatientForms(forms)
        }
      } catch (error) {
        console.error('Errore caricamento regole paziente:', error)
      }
    }
    fetchPatientRules()
  }, [selectedPazienteId])

  // Salva regola
  const saveRule = async (parameterType: string, isGlobal: boolean) => {
    setSaving(parameterType)
    setMessage(null)

    const form = isGlobal ? globalForms[parameterType] : patientForms[parameterType]
    if (!form) return

    try {
      const response = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paziente_id: isGlobal ? null : selectedPazienteId,
          parameter_type: parameterType,
          min_warning: form.min_warning ? parseFloat(form.min_warning) : null,
          max_warning: form.max_warning ? parseFloat(form.max_warning) : null,
          min_critical: form.min_critical ? parseFloat(form.min_critical) : null,
          max_critical: form.max_critical ? parseFloat(form.max_critical) : null,
          enabled: form.enabled,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Soglie salvate con successo!' })
        // Aggiorna lista regole
        if (isGlobal) {
          setGlobalRules(prev => {
            const idx = prev.findIndex(r => r.parameter_type === parameterType)
            if (idx >= 0) {
              const updated = [...prev]
              updated[idx] = data.rule
              return updated
            }
            return [...prev, data.rule]
          })
        } else {
          setPatientRules(prev => {
            const idx = prev.findIndex(r => r.parameter_type === parameterType)
            if (idx >= 0) {
              const updated = [...prev]
              updated[idx] = data.rule
              return updated
            }
            return [...prev, data.rule]
          })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore nel salvataggio' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' })
    } finally {
      setSaving(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Elimina regola paziente (torna a usare globali)
  const deletePatientRule = async (parameterType: string) => {
    const rule = patientRules.find(r => r.parameter_type === parameterType)
    if (!rule) return

    if (!confirm('Vuoi rimuovere la soglia personalizzata? Il paziente userà le soglie globali.')) {
      return
    }

    try {
      const response = await fetch(`/api/alert-rules?id=${rule.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        setPatientRules(prev => prev.filter(r => r.parameter_type !== parameterType))
        setPatientForms(prev => {
          const updated = { ...prev }
          delete updated[parameterType]
          return updated
        })
        setMessage({ type: 'success', text: 'Soglia personalizzata rimossa' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore nella rimozione' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  // Inizializza form paziente da globali
  const initPatientForm = (parameterType: string) => {
    const globalForm = globalForms[parameterType]
    if (globalForm) {
      setPatientForms(prev => ({
        ...prev,
        [parameterType]: { ...globalForm },
      }))
    }
  }

  // Render form per un parametro
  const renderParameterForm = (
    param: typeof PARAMETERS[0],
    form: ThresholdForm | undefined,
    onChange: (field: keyof ThresholdForm, value: string | boolean) => void,
    onSave: () => void,
    isGlobal: boolean,
    hasCustom: boolean
  ) => {
    const Icon = param.icon

    return (
      <div
        key={param.type}
        className={`bg-white rounded-xl border ${hasCustom && !isGlobal ? 'border-teal-300 ring-2 ring-teal-100' : 'border-gray-200'} overflow-hidden`}
      >
        <div className={`px-4 py-3 ${param.bgColor} border-b border-gray-200`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${param.color}`} />
              <div>
                <h4 className="font-semibold text-gray-900">{param.label}</h4>
                <p className="text-xs text-gray-500">{param.description}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-500">{param.unit}</span>
          </div>
        </div>

        <div className="p-4">
          {!form && !isGlobal ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">Usa soglie globali</p>
              <button
                onClick={() => initPatientForm(param.type)}
                className="px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors text-sm font-medium"
              >
                Personalizza per questo paziente
              </button>
            </div>
          ) : form ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Warning */}
                <div>
                  <label className="block text-xs font-medium text-yellow-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Attenzione (Warning)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Min"
                        value={form.min_warning}
                        onChange={(e) => onChange('min_warning', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      />
                      <span className="text-xs text-gray-400">Min</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Max"
                        value={form.max_warning}
                        onChange={(e) => onChange('max_warning', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      />
                      <span className="text-xs text-gray-400">Max</span>
                    </div>
                  </div>
                </div>

                {/* Critical */}
                <div>
                  <label className="block text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Critico (Emergency)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Min"
                        value={form.min_critical}
                        onChange={(e) => onChange('min_critical', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                      <span className="text-xs text-gray-400">Min</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Max"
                        value={form.max_critical}
                        onChange={(e) => onChange('max_critical', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                      <span className="text-xs text-gray-400">Max</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Azioni */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => onChange('enabled', e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-600">Abilitato</span>
                </label>

                <div className="flex gap-2">
                  {!isGlobal && hasCustom && (
                    <button
                      onClick={() => deletePatientRule(param.type)}
                      className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Rimuovi
                    </button>
                  )}
                  <button
                    onClick={onSave}
                    disabled={saving === param.type}
                    className="flex items-center gap-2 px-4 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {saving === param.type ? (
                      <RotateCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salva
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  const selectedPaziente = pazienti.find(p => p.id === selectedPazienteId)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-7 h-7 text-teal-600" />
              Configurazione Soglie Alert
            </h1>
            <p className="text-gray-500 mt-1">
              Definisci i valori di attenzione e critici per ogni parametro vitale
            </p>
          </div>

          {/* Messaggio */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              {message.text}
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Come funzionano le soglie</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>Warning (Attenzione):</strong> genera un alert di livello "warning" - richiede verifica</li>
                  <li><strong>Critical (Critico):</strong> genera un alert di livello "emergency" - intervento immediato</li>
                  <li>Lascia vuoto un campo se non vuoi impostare quel limite</li>
                  <li>Le soglie personalizzate per paziente sovrascrivono quelle globali</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Colonna Soglie Globali */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Soglie Globali</h2>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  Default per tutti
                </span>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <RotateCcw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Caricamento...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {PARAMETERS.map((param) =>
                    renderParameterForm(
                      param,
                      globalForms[param.type],
                      (field, value) => {
                        setGlobalForms(prev => ({
                          ...prev,
                          [param.type]: {
                            ...prev[param.type],
                            [field]: value,
                          },
                        }))
                      },
                      () => saveRule(param.type, true),
                      true,
                      false
                    )
                  )}
                </div>
              )}
            </div>

            {/* Colonna Soglie Paziente */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-gray-900">Soglie Personalizzate</h2>
              </div>

              {/* Selezione paziente */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleziona paziente
                </label>
                <div className="relative">
                  <select
                    value={selectedPazienteId || ''}
                    onChange={(e) => setSelectedPazienteId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 pr-10"
                  >
                    <option value="">-- Seleziona un paziente --</option>
                    {pazienti.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.cognome} {p.nome} (ID: {p.id})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {selectedPazienteId ? (
                <>
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-teal-800">
                      <strong>{selectedPaziente?.nome} {selectedPaziente?.cognome}</strong> -
                      Configura soglie personalizzate o usa quelle globali
                    </p>
                  </div>

                  <div className="space-y-4">
                    {PARAMETERS.map((param) => {
                      const hasCustomRule = patientRules.some(r => r.parameter_type === param.type)
                      return renderParameterForm(
                        param,
                        patientForms[param.type],
                        (field, value) => {
                          setPatientForms(prev => ({
                            ...prev,
                            [param.type]: {
                              ...prev[param.type],
                              [field]: value,
                            },
                          }))
                        },
                        () => saveRule(param.type, false),
                        false,
                        hasCustomRule
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="bg-gray-100 rounded-xl p-12 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Seleziona un paziente per configurare soglie personalizzate
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
