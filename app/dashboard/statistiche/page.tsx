'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, TrendingUp, Calendar, Users, Droplet, Heart,
  Thermometer, Activity, RefreshCw, BarChart3
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface Paziente {
  id: number
  nome: string
  cognome: string
  codice_fiscale: string | null
}

interface HealthRecord {
  id: number
  paziente_id: number
  measurement_type: string
  heart_rate: number | null
  systolic_bp: number | null
  diastolic_bp: number | null
  spo2: number | null
  temperature: string | null
  recorded_at: string
}

type DateRange = '7d' | '30d' | '3m' | '6m' | 'all'
type TabType = 'spo2' | 'heartrate' | 'temperature' | 'pressure'

export default function StatistichePage() {
  const searchParams = useSearchParams()
  const [pazienti, setPazienti] = useState<Paziente[]>([])
  const [selectedPazienteId, setSelectedPazienteId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [activeTab, setActiveTab] = useState<TabType>('heartrate')
  const [healthData, setHealthData] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Leggi paziente_id dall'URL se presente
  useEffect(() => {
    const pazienteIdParam = searchParams.get('paziente_id')
    if (pazienteIdParam) {
      const id = parseInt(pazienteIdParam)
      if (!isNaN(id)) {
        setSelectedPazienteId(id)
      }
    }
  }, [searchParams])

  // Fetch pazienti al caricamento
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

  // Fetch dati quando cambiano paziente, tab o intervallo
  useEffect(() => {
    if (!selectedPazienteId) return

    const fetchHealthData = async () => {
      setLoading(true)
      try {
        const typeMap: Record<TabType, string> = {
          spo2: 'spo2',
          heartrate: 'heart_rate',
          temperature: 'temperature',
          pressure: 'blood_pressure'
        }

        const response = await fetch(
          `/api/health-data?type=${typeMap[activeTab]}&paziente_id=${selectedPazienteId}&limit=1000`
        )
        const data = await response.json()
        if (data.success) {
          // Filtra per intervallo date
          const filtered = filterByDateRange(data.data, dateRange)
          setHealthData(filtered)
        }
      } catch (error) {
        console.error('Errore caricamento dati:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHealthData()
  }, [selectedPazienteId, activeTab, dateRange])

  const filterByDateRange = (data: HealthRecord[], range: DateRange): HealthRecord[] => {
    const now = new Date()
    const cutoffDate = new Date()

    switch (range) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoffDate.setDate(now.getDate() - 30)
        break
      case '3m':
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case '6m':
        cutoffDate.setMonth(now.getMonth() - 6)
        break
      case 'all':
        return data
    }

    return data.filter(record => new Date(record.recorded_at) >= cutoffDate)
  }

  const prepareChartData = () => {
    if (healthData.length === 0) return []

    // Raggruppa per giorno
    const grouped: { [key: string]: number[] } = {}

    healthData.forEach(record => {
      const date = new Date(record.recorded_at).toLocaleDateString('it-IT')
      if (!grouped[date]) grouped[date] = []

      let value: number | null = null
      switch (activeTab) {
        case 'heartrate':
          value = record.heart_rate
          break
        case 'spo2':
          value = record.spo2
          break
        case 'temperature':
          value = record.temperature ? parseFloat(record.temperature) : null
          break
        case 'pressure':
          value = record.systolic_bp // Useremo sia systolic che diastolic
          break
      }

      if (value !== null) grouped[date].push(value)
    })

    // Calcola media per giorno e ordina
    const chartData = Object.entries(grouped)
      .map(([date, values]) => ({
        date,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      }))
      .sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('/')
        const [dayB, monthB, yearB] = b.date.split('/')
        return new Date(`${yearA}-${monthA}-${dayA}`).getTime() -
               new Date(`${yearB}-${monthB}-${dayB}`).getTime()
      })

    return chartData
  }

  // Prepara dati per pressione (doppia linea)
  const preparePressureData = () => {
    if (healthData.length === 0) return []

    const grouped: { [key: string]: { systolic: number[], diastolic: number[] } } = {}

    healthData.forEach(record => {
      const date = new Date(record.recorded_at).toLocaleDateString('it-IT')
      if (!grouped[date]) grouped[date] = { systolic: [], diastolic: [] }

      if (record.systolic_bp) grouped[date].systolic.push(record.systolic_bp)
      if (record.diastolic_bp) grouped[date].diastolic.push(record.diastolic_bp)
    })

    return Object.entries(grouped)
      .map(([date, values]) => ({
        date,
        systolic: values.systolic.length > 0 ?
          values.systolic.reduce((a, b) => a + b, 0) / values.systolic.length : 0,
        diastolic: values.diastolic.length > 0 ?
          values.diastolic.reduce((a, b) => a + b, 0) / values.diastolic.length : 0
      }))
      .sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('/')
        const [dayB, monthB, yearB] = b.date.split('/')
        return new Date(`${yearA}-${monthA}-${dayA}`).getTime() -
               new Date(`${yearB}-${monthB}-${dayB}`).getTime()
      })
  }

  const selectedPatient = pazienti.find(p => p.id === selectedPazienteId)
  const chartData = activeTab === 'pressure' ? preparePressureData() : prepareChartData()

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

      <main className="pt-16 lg:pt-0 lg:ml-64 transition-all duration-300">
        <header className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 lg:gap-3">
                  <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8" />
                  Statistiche Salute
                </h1>
                <p className="text-gray-300 text-sm lg:text-base mt-1">Analisi e trend delle misurazioni</p>
              </div>
            </div>
          </div>
        </header>

        <div className="relative z-10 p-4 sm:p-6 lg:p-8 space-y-4 lg:space-y-6">
          {/* Selezione Paziente */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl lg:rounded-2xl p-4 lg:p-6">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm sm:text-base">
              <Users className="w-5 h-5" />
              Seleziona Paziente
            </h2>
            <select
              value={selectedPazienteId || ''}
              onChange={(e) => setSelectedPazienteId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 sm:px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-emerald-500 cursor-pointer min-h-[48px] text-sm sm:text-base"
            >
              <option value="" className="bg-slate-900">Seleziona un paziente...</option>
              {pazienti.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  {p.cognome} {p.nome} {p.codice_fiscale ? `- ${p.codice_fiscale}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedPazienteId ? (
            <>
              {/* Info Paziente + Intervallo Date */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {/* Paziente Selezionato */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 lg:p-6">
                  <p className="text-emerald-300 text-xs sm:text-sm mb-2">Paziente selezionato</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-base lg:text-lg flex-shrink-0">
                      {selectedPatient?.nome.charAt(0)}{selectedPatient?.cognome.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-base sm:text-lg lg:text-xl truncate">
                        {selectedPatient?.cognome} {selectedPatient?.nome}
                      </p>
                      <p className="text-gray-300 text-xs sm:text-sm truncate">{selectedPatient?.codice_fiscale}</p>
                    </div>
                  </div>
                </div>

                {/* Intervallo Date */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 lg:p-6">
                  <p className="text-gray-300 text-xs sm:text-sm mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Intervallo Temporale
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[
                      { value: '7d', label: '7gg' },
                      { value: '30d', label: '30gg' },
                      { value: '3m', label: '3m' },
                      { value: '6m', label: '6m' },
                      { value: 'all', label: 'Tutto' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setDateRange(option.value as DateRange)}
                        className={`px-2 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[44px] ${
                          dateRange === option.value
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab Navigation - Scrollabile su mobile */}
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-1.5 sm:p-2 overflow-x-auto">
                <div className="flex gap-1 sm:gap-2 min-w-max lg:min-w-0">
                  <button
                    onClick={() => setActiveTab('heartrate')}
                    className={`flex-shrink-0 lg:flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] text-sm sm:text-base ${
                      activeTab === 'heartrate'
                        ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                    <span className="whitespace-nowrap">Battito</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('spo2')}
                    className={`flex-shrink-0 lg:flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] text-sm sm:text-base ${
                      activeTab === 'spo2'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <Droplet className="w-4 h-4" />
                    <span className="whitespace-nowrap">SpO2</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('temperature')}
                    className={`flex-shrink-0 lg:flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] text-sm sm:text-base ${
                      activeTab === 'temperature'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <Thermometer className="w-4 h-4" />
                    <span className="whitespace-nowrap">Temp.</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('pressure')}
                    className={`flex-shrink-0 lg:flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] text-sm sm:text-base ${
                      activeTab === 'pressure'
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    <span className="whitespace-nowrap">Pressione</span>
                  </button>
                </div>
              </div>

              {/* Chart Area */}
              {loading ? (
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl lg:rounded-2xl p-8 lg:p-12 text-center">
                  <RefreshCw className="w-10 h-10 lg:w-12 lg:h-12 text-emerald-400 animate-spin mx-auto mb-4" />
                  <p className="text-white text-sm sm:text-base">Caricamento dati...</p>
                </div>
              ) : chartData.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl lg:rounded-2xl p-8 lg:p-12 text-center">
                  <BarChart3 className="w-12 h-12 lg:w-16 lg:h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-white text-base lg:text-lg">Nessun dato disponibile</p>
                  <p className="text-gray-400 mt-2 text-sm">Prova a selezionare un intervallo temporale diverso</p>
                </div>
              ) : (
                <div className="space-y-4 lg:space-y-6">
                  {/* Grafico Principale - Line Chart */}
                  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl lg:rounded-2xl p-4 lg:p-6">
                    <h3 className="text-white font-bold text-sm sm:text-base lg:text-lg mb-3 lg:mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
                      {activeTab === 'heartrate' && 'Trend Battito Cardiaco'}
                      {activeTab === 'spo2' && 'Trend Saturazione Ossigeno'}
                      {activeTab === 'temperature' && 'Trend Temperatura'}
                      {activeTab === 'pressure' && 'Trend Pressione Sanguigna'}
                    </h3>
                    <ResponsiveContainer width="100%" height={300} className="lg:!h-[400px]">
                      {activeTab === 'pressure' ? (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                          <XAxis
                            dataKey="date"
                            stroke="#fff"
                            tick={{ fill: '#9ca3af' }}
                          />
                          <YAxis stroke="#fff" tick={{ fill: '#9ca3af' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '8px'
                            }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="systolic"
                            stroke="#a855f7"
                            strokeWidth={2}
                            name="Sistolica"
                            dot={{ fill: '#a855f7', r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="diastolic"
                            stroke="#6366f1"
                            strokeWidth={2}
                            name="Diastolica"
                            dot={{ fill: '#6366f1', r: 4 }}
                          />
                        </LineChart>
                      ) : (
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={
                                activeTab === 'heartrate' ? '#ef4444' :
                                activeTab === 'spo2' ? '#3b82f6' :
                                '#f59e0b'
                              } stopOpacity={0.8}/>
                              <stop offset="95%" stopColor={
                                activeTab === 'heartrate' ? '#ef4444' :
                                activeTab === 'spo2' ? '#3b82f6' :
                                '#f59e0b'
                              } stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                          <XAxis
                            dataKey="date"
                            stroke="#fff"
                            tick={{ fill: '#9ca3af' }}
                          />
                          <YAxis stroke="#fff" tick={{ fill: '#9ca3af' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '8px'
                            }}
                            labelStyle={{ color: '#fff' }}
                            itemStyle={{ color: '#fbbf24' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="avg"
                            stroke={
                              activeTab === 'heartrate' ? '#ef4444' :
                              activeTab === 'spo2' ? '#3b82f6' :
                              '#f59e0b'
                            }
                            fillOpacity={1}
                            fill="url(#colorAvg)"
                            strokeWidth={3}
                            name="Media"
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Grafico Secondario - Bar Chart Min/Max */}
                  {activeTab !== 'pressure' && (
                    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                      <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Variazione Min/Max
                      </h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                          <XAxis
                            dataKey="date"
                            stroke="#fff"
                            tick={{ fill: '#9ca3af' }}
                          />
                          <YAxis stroke="#fff" tick={{ fill: '#9ca3af' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '8px'
                            }}
                            labelStyle={{ color: '#fff' }}
                            itemStyle={{ color: '#fbbf24' }}
                          />
                          <Legend />
                          <Bar dataKey="min" fill="#10b981" name="Minimo" />
                          <Bar dataKey="max" fill="#f59e0b" name="Massimo" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-lg border border-cyan-500/30 rounded-2xl p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-cyan-500/20 rounded-full mb-6">
                <Users className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Seleziona un Paziente</h3>
              <p className="text-gray-300 max-w-md mx-auto">
                Utilizza il menu a tendina in alto per selezionare un paziente e visualizzare
                le statistiche e i grafici delle sue misurazioni nel tempo.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
