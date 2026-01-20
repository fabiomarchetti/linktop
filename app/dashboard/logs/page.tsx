'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ScrollText, Filter, RefreshCw, Search,
  User, LogIn, LogOut, Eye, Calendar, Clock
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'

interface AccessLog {
  id: number
  user_id: number
  username: string
  nome: string
  cognome: string
  ruolo: string
  action_type: 'login' | 'logout' | 'page_visit'
  page_url: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface User {
  id: number
  nome: string
  cognome: string
  username: string
}

export default function LogsPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<number | null>(null)
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const logsPerPage = 50

  // Protezione: solo sviluppatore
  if (user && user.ruolo !== 'sviluppatore') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-orange-700 to-red-800 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ScrollText className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Accesso Negato</h1>
          <p className="text-gray-300 mb-6">
            Solo gli sviluppatori possono accedere ai log di sistema.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Torna alla Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedUser) params.append('user_id', selectedUser.toString())
      if (selectedAction) params.append('action_type', selectedAction)
      params.append('limit', logsPerPage.toString())
      params.append('offset', ((currentPage - 1) * logsPerPage).toString())

      const response = await fetch(`/api/access-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
        setTotalLogs(data.pagination.total)
      }
    } catch (error) {
      console.error('Errore caricamento logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Errore caricamento utenti:', error)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [selectedUser, selectedAction, currentPage])

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      log.username.toLowerCase().includes(search) ||
      log.nome?.toLowerCase().includes(search) ||
      log.cognome?.toLowerCase().includes(search) ||
      log.page_url?.toLowerCase().includes(search)
    )
  })

  const totalPages = Math.ceil(totalLogs / logsPerPage)

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <LogIn className="w-4 h-4 text-emerald-400" />
      case 'logout': return <LogOut className="w-4 h-4 text-orange-400" />
      case 'page_visit': return <Eye className="w-4 h-4 text-blue-400" />
      default: return <User className="w-4 h-4" />
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'login':
        return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs font-semibold">Login</span>
      case 'logout':
        return <span className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs font-semibold">Logout</span>
      case 'page_visit':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">Visita</span>
      default:
        return <span className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs font-semibold">{action}</span>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Rome'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-slate-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gray-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-slate-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
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
                  <ScrollText className="w-8 h-8" />
                  Logs Accessi
                </h1>
                <p className="text-gray-300 mt-1">Tracciamento accessi e navigazione utenti</p>
              </div>
            </div>
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>
          </div>
        </header>

        <div className="relative z-10 p-8 space-y-6">
          {/* Filtri */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtri
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro Utente */}
              <div>
                <label className="text-gray-300 text-sm mb-2 block flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Utente
                </label>
                <select
                  value={selectedUser || ''}
                  onChange={(e) => {
                    setSelectedUser(e.target.value ? Number(e.target.value) : null)
                    setCurrentPage(1)
                  }}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="" className="bg-slate-900">Tutti gli utenti</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-slate-900">
                      {u.cognome} {u.nome} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Azione */}
              <div>
                <label className="text-gray-300 text-sm mb-2 block flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Tipo Azione
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => {
                    setSelectedAction(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="" className="bg-slate-900">Tutte le azioni</option>
                  <option value="login" className="bg-slate-900">Login</option>
                  <option value="logout" className="bg-slate-900">Logout</option>
                  <option value="page_visit" className="bg-slate-900">Visite Pagine</option>
                </select>
              </div>

              {/* Ricerca */}
              <div>
                <label className="text-gray-300 text-sm mb-2 block flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Ricerca
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome, username, URL..."
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Statistiche rapide */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-300 text-sm">Login Totali</p>
                  <p className="text-white text-2xl font-bold">
                    {logs.filter(l => l.action_type === 'login').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <LogOut className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-orange-300 text-sm">Logout Totali</p>
                  <p className="text-white text-2xl font-bold">
                    {logs.filter(l => l.action_type === 'logout').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Eye className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-blue-300 text-sm">Visite Pagine</p>
                  <p className="text-white text-2xl font-bold">
                    {logs.filter(l => l.action_type === 'page_visit').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <ScrollText className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-purple-300 text-sm">Totale Log</p>
                  <p className="text-white text-2xl font-bold">{totalLogs}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabella Logs */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
                  <p className="text-white">Caricamento logs...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-12 text-center">
                  <ScrollText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-white text-lg">Nessun log trovato</p>
                  <p className="text-gray-400 mt-2">Prova a modificare i filtri</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        <Clock className="w-4 h-4 inline mr-2" />
                        Data/Ora
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        <User className="w-4 h-4 inline mr-2" />
                        Utente
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Azione
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Pagina/URL
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        IP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{formatDate(log.created_at)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {log.nome?.charAt(0)}{log.cognome?.charAt(0)}
                            </div>
                            <div>
                              <div className="text-white font-semibold">
                                {log.cognome} {log.nome}
                              </div>
                              <div className="text-gray-400 text-sm">@{log.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action_type)}
                            {getActionBadge(log.action_type)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-300 max-w-md truncate">
                            {log.page_url || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">{log.ip_address || '-'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginazione */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Pagina {currentPage} di {totalPages} ({totalLogs} log totali)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Precedente
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Successiva
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
