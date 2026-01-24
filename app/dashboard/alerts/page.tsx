'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
  User,
  Activity,
  ChevronRight,
  Eye,
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'

interface Alert {
  id: number
  paziente_id: number
  alert_type: string
  severity: 'info' | 'warning' | 'alarm' | 'emergency'
  parameter_type: string
  measured_value: number
  threshold_exceeded: number | null
  message: string
  status: 'active' | 'acknowledged' | 'resolved' | 'false_positive' | 'escalated'
  escalation_level: number
  created_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  nome: string
  cognome: string
}

interface AlertCounts {
  emergency: number
  alarm: number
  warning: number
  info: number
}

type FilterStatus = 'active' | 'acknowledged' | 'resolved' | 'all'
type FilterSeverity = 'emergency' | 'alarm' | 'warning' | 'info' | 'all'

const SEVERITY_CONFIG = {
  emergency: {
    label: 'Emergenza',
    icon: AlertCircle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-500',
    badgeColor: 'bg-red-500',
  },
  alarm: {
    label: 'Allarme',
    icon: AlertTriangle,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-500',
    badgeColor: 'bg-orange-500',
  },
  warning: {
    label: 'Attenzione',
    icon: AlertTriangle,
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-500',
    badgeColor: 'bg-yellow-500',
  },
  info: {
    label: 'Info',
    icon: Info,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-500',
    badgeColor: 'bg-blue-500',
  },
}

const STATUS_CONFIG = {
  active: { label: 'Attivo', color: 'text-red-600', bg: 'bg-red-100' },
  escalated: { label: 'Escalato', color: 'text-orange-600', bg: 'bg-orange-100' },
  acknowledged: { label: 'Preso in carico', color: 'text-blue-600', bg: 'bg-blue-100' },
  resolved: { label: 'Risolto', color: 'text-green-600', bg: 'bg-green-100' },
  false_positive: { label: 'Falso positivo', color: 'text-gray-600', bg: 'bg-gray-100' },
}

const PARAMETER_LABELS: Record<string, string> = {
  heart_rate: 'Frequenza cardiaca',
  spo2: 'Saturazione O2',
  systolic_bp: 'Pressione sistolica',
  diastolic_bp: 'Pressione diastolica',
  temperature: 'Temperatura',
}

const PARAMETER_UNITS: Record<string, string> = {
  heart_rate: 'bpm',
  spo2: '%',
  systolic_bp: 'mmHg',
  diastolic_bp: 'mmHg',
  temperature: '°C',
}

export default function AlertsPage() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [counts, setCounts] = useState<AlertCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active')
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('status', filterStatus)
      params.set('severity', filterSeverity)
      params.set('include_counts', 'true')
      params.set('limit', '100')

      const response = await fetch(`/api/alerts?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setAlerts(data.alerts)
        setCounts(data.counts)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Errore caricamento alert:', error)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterSeverity])

  // Initial fetch e auto-refresh
  useEffect(() => {
    fetchAlerts()

    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, 10000) // Refresh ogni 10 secondi
      return () => clearInterval(interval)
    }
  }, [fetchAlerts, autoRefresh])

  // Azione su alert
  const handleAlertAction = async (alertId: number, action: string) => {
    setActionLoading(alertId)
    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alertId,
          action,
          user_id: user?.id,
        }),
      })

      const data = await response.json()
      if (data.success) {
        fetchAlerts() // Ricarica lista
      }
    } catch (error) {
      console.error('Errore azione alert:', error)
    } finally {
      setActionLoading(null)
    }
  }

  // Formatta data/ora
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Tempo trascorso
  const getTimeAgo = (dateStr: string) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Adesso'
    if (diffMins < 60) return `${diffMins} min fa`
    if (diffHours < 24) return `${diffHours} ore fa`
    return `${diffDays} giorni fa`
  }

  // Conteggio totale alert attivi
  const totalActiveAlerts = counts
    ? counts.emergency + counts.alarm + counts.warning + counts.info
    : 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-7 h-7 text-teal-600" />
                  Alert Control Room
                </h1>
                <p className="text-gray-500 mt-1">
                  Monitoraggio alert in tempo reale
                </p>
              </div>

              {/* Auto-refresh toggle */}
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
                </div>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    autoRefresh
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={fetchAlerts}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Aggiorna ora"
                >
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Contatori severità */}
          {counts && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {(['emergency', 'alarm', 'warning', 'info'] as const).map((severity) => {
                const config = SEVERITY_CONFIG[severity]
                const Icon = config.icon
                const count = counts[severity]

                return (
                  <button
                    key={severity}
                    onClick={() => setFilterSeverity(filterSeverity === severity ? 'all' : severity)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      filterSeverity === severity
                        ? `${config.borderColor} ${config.bgColor}`
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`w-5 h-5 ${config.textColor}`} />
                      </div>
                      <span className={`text-3xl font-bold ${count > 0 ? config.textColor : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm font-medium ${config.textColor}`}>
                      {config.label}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          {/* Filtri */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtri:</span>
              </div>

              {/* Filtro stato */}
              <div className="flex gap-2">
                {(['active', 'acknowledged', 'resolved', 'all'] as FilterStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filterStatus === status
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'active' && 'Attivi'}
                    {status === 'acknowledged' && 'In carico'}
                    {status === 'resolved' && 'Risolti'}
                    {status === 'all' && 'Tutti'}
                  </button>
                ))}
              </div>

              {/* Reset filtri */}
              {(filterStatus !== 'active' || filterSeverity !== 'all') && (
                <button
                  onClick={() => {
                    setFilterStatus('active')
                    setFilterSeverity('all')
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Reset filtri
                </button>
              )}
            </div>
          </div>

          {/* Lista Alert */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Caricamento alert...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nessun alert {filterStatus === 'active' ? 'attivo' : ''}
                </h3>
                <p className="text-gray-500">
                  {filterStatus === 'active'
                    ? 'Tutti i parametri vitali sono nella norma.'
                    : 'Nessun alert corrisponde ai filtri selezionati.'}
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const severityConfig = SEVERITY_CONFIG[alert.severity]
                const statusConfig = STATUS_CONFIG[alert.status]
                const SeverityIcon = severityConfig.icon
                const isActive = alert.status === 'active' || alert.status === 'escalated'

                return (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-xl shadow-sm border-l-4 ${severityConfig.borderColor} overflow-hidden`}
                  >
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        {/* Icona severità */}
                        <div className={`p-3 rounded-xl ${severityConfig.bgColor} shrink-0`}>
                          <SeverityIcon className={`w-6 h-6 ${severityConfig.textColor}`} />
                        </div>

                        {/* Contenuto principale */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${severityConfig.bgColor} ${severityConfig.textColor}`}>
                              {severityConfig.label}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {getTimeAgo(alert.created_at)}
                            </span>
                          </div>

                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {alert.nome} {alert.cognome}
                          </h3>

                          <p className="text-gray-600 mb-3">
                            {alert.message}
                          </p>

                          {/* Dettagli parametro */}
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">
                                {PARAMETER_LABELS[alert.parameter_type] || alert.parameter_type}:
                              </span>
                              <span className={`font-bold ${severityConfig.textColor}`}>
                                {alert.measured_value}{PARAMETER_UNITS[alert.parameter_type] || ''}
                              </span>
                              {alert.threshold_exceeded && (
                                <span className="text-gray-500">
                                  (soglia: {alert.threshold_exceeded}{PARAMETER_UNITS[alert.parameter_type] || ''})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-500">
                              <User className="w-4 h-4" />
                              ID: #{alert.paziente_id}
                            </div>
                          </div>
                        </div>

                        {/* Azioni */}
                        <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                          {isActive && (
                            <>
                              <button
                                onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                                disabled={actionLoading === alert.id}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Prendi in carico
                              </button>
                              <button
                                onClick={() => handleAlertAction(alert.id, 'resolve')}
                                disabled={actionLoading === alert.id}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Risolvi
                              </button>
                            </>
                          )}

                          {alert.status === 'acknowledged' && (
                            <button
                              onClick={() => handleAlertAction(alert.id, 'resolve')}
                              disabled={actionLoading === alert.id}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Risolvi
                            </button>
                          )}

                          {isActive && (
                            <button
                              onClick={() => handleAlertAction(alert.id, 'false_positive')}
                              disabled={actionLoading === alert.id}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                              <XCircle className="w-4 h-4" />
                              Falso positivo
                            </button>
                          )}

                          <Link
                            href={`/dashboard/statistiche?paziente_id=${alert.paziente_id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            Vedi paziente
                          </Link>
                        </div>
                      </div>

                      {/* Timestamp dettagliati */}
                      {(alert.acknowledged_at || alert.resolved_at) && (
                        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                          {alert.acknowledged_at && (
                            <span className="mr-4">
                              Preso in carico: {formatDateTime(alert.acknowledged_at)}
                            </span>
                          )}
                          {alert.resolved_at && (
                            <span>
                              Risolto: {formatDateTime(alert.resolved_at)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Info totale */}
          {!loading && alerts.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-500">
              Visualizzati {alerts.length} alert
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
