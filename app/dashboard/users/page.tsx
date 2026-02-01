'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Users, UserPlus, Edit2, Trash2, Check, X,
  RefreshCw, Shield, Search, AlertTriangle, Maximize2, Minimize2
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { useSidebar } from '@/contexts/SidebarContext'
import { getRoleEmoji } from '@/lib/permissions'

interface User {
  id: number
  nome: string
  cognome: string
  username: string
  email: string
  active: boolean
  ruolo_id: number
  nome_ruolo: string
  ruolo_descrizione: string
  livello_accesso: number
  created_at: string
  updated_at: string
}

interface Role {
  id: number
  nome_ruolo: string
  descrizione: string
  livello_accesso: number
}

const roles: Role[] = [
  { id: 1, nome_ruolo: 'sviluppatore', descrizione: 'Accesso completo', livello_accesso: 5 },
  { id: 2, nome_ruolo: 'animatore_digitale', descrizione: 'Gestione dispositivi medici', livello_accesso: 4 },
  { id: 3, nome_ruolo: 'assistente_control', descrizione: 'Monitoraggio multi-paziente', livello_accesso: 3 },
  { id: 4, nome_ruolo: 'controllo_parentale', descrizione: 'Monitoraggio pazienti assegnati', livello_accesso: 2 },
  { id: 5, nome_ruolo: 'utente_base', descrizione: 'Solo propri dati', livello_accesso: 1 },
]

export default function UsersPage() {
  const { isOpen: sidebarOpen, isMobile, isFullscreen, toggleFullscreen } = useSidebar()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    nome: '',
    cognome: '',
    username: '',
    email: '',
    password: '',
    ruolo_id: 1,
    active: true
  })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Errore caricamento utenti:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEditForm({
      nome: user.nome,
      cognome: user.cognome,
      username: user.username,
      email: user.email || '',
      password: '',
      ruolo_id: user.ruolo_id,
      active: user.active
    })
  }

  const handleSave = async () => {
    if (!editingUser) return

    setSaving(true)
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Operatore aggiornato con successo' })
        setEditingUser(null)
        fetchUsers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore aggiornamento' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' })
    } finally {
      setSaving(false)
    }

    setTimeout(() => setMessage(null), 3000)
  }

  const handleDelete = async (userId: number) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Operatore eliminato' })
        fetchUsers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore eliminazione' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' })
    }

    setDeleteConfirm(null)
    setTimeout(() => setMessage(null), 3000)
  }

  const filteredUsers = users.filter(user =>
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.cognome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nome_ruolo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleBadgeColor = (ruolo: string) => {
    switch (ruolo) {
      case 'sviluppatore': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'animatore_digitale': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'assistente_control': return 'bg-teal-500/20 text-teal-300 border-teal-500/30'
      case 'controllo_parentale': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
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

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-2 right-2 z-20 p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-full transition-all border border-white/20"
        title={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        ) : (
          <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        )}
      </button>

      <main className={`pt-16 lg:pt-0 transition-all duration-300 ${
        sidebarOpen && !isMobile ? 'lg:ml-64' : 'lg:ml-0'
      }`}>
        <header className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className={`flex items-center gap-3 lg:gap-4 ${!sidebarOpen && !isMobile ? 'lg:ml-10' : ''}`}>
              <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 lg:gap-3">
                  <Users className="w-6 h-6 lg:w-8 lg:h-8" />
                  Gestione Staff
                </h1>
                <p className="text-gray-300 text-sm lg:text-base mt-1">{users.length} operatori registrati</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca operatori..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 min-h-[44px] text-sm sm:text-base"
                />
              </div>

              <button
                onClick={fetchUsers}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>

              <Link
                href="/register"
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg min-h-[44px] text-sm sm:text-base"
              >
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Nuovo Operatore</span>
                <span className="sm:hidden">Nuovo</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
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

          {/* Users Table - Responsive con scroll orizzontale */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Operatore</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Username</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300 hidden md:table-cell">Email</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300">Ruolo</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-center text-xs sm:text-sm font-semibold text-gray-300">Stato</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs sm:text-sm font-semibold text-gray-300 hidden lg:table-cell">Registrato</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-center text-xs sm:text-sm font-semibold text-gray-300">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
                      <p className="text-gray-300">Caricamento operatori...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                      <p className="text-gray-300">Nessun operatore trovato</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-lg shadow-lg">
                            {getRoleEmoji(user.nome_ruolo)}
                          </div>
                          <div>
                            <div className="text-white font-semibold">{user.nome} {user.cognome}</div>
                            <div className="text-gray-400 text-xs">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-200 font-mono">{user.username}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">{user.email || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(user.nome_ruolo)}`}>
                          {user.nome_ruolo.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user.active ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
                            Attivo
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full border border-red-500/30">
                            Disattivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300 text-sm">{formatDate(user.created_at)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all"
                            title="Modifica"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {user.username !== 'admin' && (
                            <>
                              {deleteConfirm === user.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(user.id)}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                                    title="Conferma eliminazione"
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
                                  onClick={() => setDeleteConfirm(user.id)}
                                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                                  title="Elimina"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-md mx-2 sm:mx-4 shadow-2xl max-h-[95vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                Modifica Operatore
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Nome</label>
                    <input
                      type="text"
                      value={editForm.nome}
                      onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Cognome</label>
                    <input
                      type="text"
                      value={editForm.cognome}
                      onChange={(e) => setEditForm({ ...editForm, cognome: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Username</label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Nuova Password (lascia vuoto per non cambiare)</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Ruolo</label>
                  <select
                    value={editForm.ruolo_id}
                    onChange={(e) => setEditForm({ ...editForm, ruolo_id: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id} className="bg-slate-900">
                        {getRoleEmoji(role.nome_ruolo)} {role.nome_ruolo.replace('_', ' ')} - {role.descrizione}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm">Stato:</label>
                  <button
                    onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      editForm.active
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {editForm.active ? 'Attivo' : 'Disattivo'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
