'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import Sidebar from '@/components/Sidebar'
import { Activity, Users, Heart, Stethoscope, Eye, TrendingUp, Maximize2, Minimize2 } from 'lucide-react'

interface DashboardStats {
  pazienti_totali: number
  dispositivi_attivi: number
  misurazioni_oggi: number
  alert_attivi: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { isOpen: sidebarOpen, isMobile, isFullscreen, toggleFullscreen } = useSidebar()
  const [stats, setStats] = useState<DashboardStats>({
    pazienti_totali: 0,
    dispositivi_attivi: 0,
    misurazioni_oggi: 0,
    alert_attivi: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats')
        const data = await response.json()
        if (data.success) {
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Errore caricamento statistiche:', error)
      } finally {
        setLoading(false)
      }
    }

    if (isAuthenticated) {
      fetchStats()
    }
  }, [isAuthenticated])

  if (!user) {
    return null
  }

  const statsCards = [
    {
      icon: <Users className="w-5 h-5 sm:w-6 sm:h-6" />,
      label: 'Pazienti',
      value: loading ? '...' : stats.pazienti_totali.toString(),
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: <Activity className="w-5 h-5 sm:w-6 sm:h-6" />,
      label: 'Dispositivi',
      value: loading ? '...' : stats.dispositivi_attivi.toString(),
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: <Heart className="w-5 h-5 sm:w-6 sm:h-6" />,
      label: 'Misurazioni',
      value: loading ? '...' : stats.misurazioni_oggi.toString(),
      color: 'from-red-500 to-red-600',
    },
    {
      icon: <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />,
      label: 'Alert',
      value: loading ? '...' : stats.alert_attivi.toString(),
      color: 'from-orange-500 to-orange-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar />

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className={`fixed top-2 z-20 p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-full transition-all border border-white/20 ${
          sidebarOpen && !isMobile ? 'right-2' : 'right-2'
        }`}
        title={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        ) : (
          <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        )}
      </button>

      <main className={`pt-16 lg:pt-0 p-3 sm:p-4 lg:p-6 transition-all duration-300 ${
        sidebarOpen && !isMobile ? 'lg:ml-64' : 'lg:ml-0'
      }`}>
        {/* Header */}
        <div className="mb-4 lg:mb-6 text-center">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">
            Monitoraggio Salute
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm">
            Benvenuto, <span className="text-emerald-400 font-semibold">{user.nome} {user.cognome}</span> ({user.ruolo})
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 lg:mb-6">
          {statsCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-xl rounded-lg lg:rounded-xl p-3 sm:p-4 lg:p-5 border border-white/10 hover:border-emerald-500/50 transition-all"
            >
              <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center text-white mb-2 lg:mb-3 shadow-lg`}>
                <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7">{stat.icon}</div>
              </div>
              <p className="text-gray-400 text-[10px] sm:text-xs mb-0.5">{stat.label}</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions - Nascosto per assistente_control_room */}
        {user.ruolo !== 'assistente_control_room' && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-4 lg:mb-6">
            <QuickActionCard
              icon={<Heart className="w-4 h-4 sm:w-5 sm:h-5" />}
              title="Health Monitor"
              description="Parametri vitali"
              href="/dashboard/health-monitor"
              color="from-red-500 to-pink-600"
            />
            <QuickActionCard
              icon={<Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />}
              title="Stetoscopio"
              description="Auscultazione"
              href="/dashboard/stetoscopio"
              color="from-blue-500 to-cyan-600"
            />
            <QuickActionCard
              icon={<Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
              title="Otoscopio"
              description="Ispezione"
              href="/dashboard/otoscopio"
              color="from-purple-500 to-indigo-600"
            />
          </div>
        )}

      </main>
    </div>
  )
}

function QuickActionCard({
  icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  color: string
}) {
  return (
    <a
      href={href}
      className="bg-white/5 backdrop-blur-xl rounded-lg lg:rounded-xl p-3 sm:p-4 lg:p-5 border border-white/10 hover:border-emerald-500/50 transition-all group"
    >
      <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r ${color} rounded-lg flex items-center justify-center text-white mb-2 lg:mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xs sm:text-sm lg:text-base font-bold text-white mb-0.5">{title}</h3>
      <p className="text-gray-400 text-[10px] sm:text-xs">{description}</p>
    </a>
  )
}

