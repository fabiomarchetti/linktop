'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Activity, Droplet, Thermometer, ArrowLeft, RefreshCw } from 'lucide-react'

interface Utente {
  id: number
  nome: string
  device_id: number | null
}

interface HealthData {
  heart_rate: number | null
  systolic_bp: number | null
  diastolic_bp: number | null
  spo2: number | null
  temperature: number | null
  timestamp: string | null
}

export default function UtenteHeartMonitorPage() {
  const router = useRouter()
  const [utente, setUtente] = useState<Utente | null>(null)
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const utenteData = sessionStorage.getItem('linktop_utente')
      if (!utenteData) {
        router.push('/utente')
        return
      }
      const user = JSON.parse(utenteData)
      setUtente(user)

      // Carica dati iniziali
      fetchHealthData(user.id)
    }
  }, [router])

  const fetchHealthData = async (pazienteId: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/health-data/latest/${pazienteId}`)
      const data = await response.json()

      if (data.success && data.data) {
        setHealthData(data.data)
      }
    } catch (error) {
      console.error('Error fetching health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (utente) {
      fetchHealthData(utente.id)
    }
  }

  if (!utente) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-pink-700 flex items-center justify-center">
        <div className="text-white text-2xl">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-pink-700 to-rose-800 p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/utente/home')}
            className="p-4 bg-white/20 backdrop-blur-lg rounded-full shadow-lg hover:bg-white/30 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>

          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
            <Heart className="w-10 h-10" />
            Heart Monitor
          </h1>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-4 bg-white/20 backdrop-blur-lg rounded-full shadow-lg hover:bg-white/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-6 h-6 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Health Cards */}
        <div className="space-y-4">
          {/* Battito Cardiaco */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-4 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-red-500/30 rounded-full flex items-center justify-center">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">Battito Cardiaco</h2>
                  <p className="text-white/70 text-lg">BPM</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-6xl font-bold">
                  {healthData?.heart_rate || '--'}
                </p>
              </div>
            </div>
            {healthData?.timestamp && (
              <p className="text-white/60 text-sm text-right">
                Ultimo aggiornamento: {new Date(healthData.timestamp).toLocaleString('it-IT')}
              </p>
            )}
          </div>

          {/* Pressione Sanguigna */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-4 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500/30 rounded-full flex items-center justify-center">
                  <Activity className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">Pressione</h2>
                  <p className="text-white/70 text-lg">mmHg</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-6xl font-bold">
                  {healthData?.systolic_bp && healthData?.diastolic_bp
                    ? `${healthData.systolic_bp}/${healthData.diastolic_bp}`
                    : '--/--'}
                </p>
              </div>
            </div>
          </div>

          {/* Ossigeno */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-4 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-cyan-500/30 rounded-full flex items-center justify-center">
                  <Droplet className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">Ossigeno</h2>
                  <p className="text-white/70 text-lg">SpO2 %</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-6xl font-bold">
                  {healthData?.spo2 || '--'}%
                </p>
              </div>
            </div>
          </div>

          {/* Temperatura */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-4 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-500/30 rounded-full flex items-center justify-center">
                  <Thermometer className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">Temperatura</h2>
                  <p className="text-white/70 text-lg">°C</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-6xl font-bold">
                  {healthData?.temperature || '--'}°
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Message */}
        {!healthData && !loading && (
          <div className="mt-6 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/20">
            <p className="text-white text-xl text-center">
              Nessuna misurazione disponibile. Inizia una nuova misurazione con il tuo dispositivo.
            </p>
          </div>
        )}

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
