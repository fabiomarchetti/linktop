'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '@/components/Sidebar'
import { Activity, Users, Heart, Stethoscope, Eye, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  if (!user) {
    return null
  }

  const stats = [
    {
      icon: <Users className="w-8 h-8" />,
      label: 'Pazienti Totali',
      value: '0',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: <Activity className="w-8 h-8" />,
      label: 'Dispositivi Attivi',
      value: '0',
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: <Heart className="w-8 h-8" />,
      label: 'Misurazioni Oggi',
      value: '0',
      color: 'from-red-500 to-red-600',
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      label: 'Alert Attivi',
      value: '0',
      color: 'from-orange-500 to-orange-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar />

      <main className="ml-64 p-8 transition-all duration-300">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Dashboard LINKTOP
          </h1>
          <p className="text-gray-400">
            Benvenuto, <span className="text-emerald-400 font-semibold">{user.nome} {user.cognome}</span> ({user.ruolo})
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-emerald-500/50 transition-all"
            >
              <div className={`w-16 h-16 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center text-white mb-4 shadow-lg`}>
                {stat.icon}
              </div>
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <QuickActionCard
            icon={<Heart className="w-6 h-6" />}
            title="Health Monitor"
            description="Misura parametri vitali"
            href="/dashboard/health-monitor"
            color="from-red-500 to-pink-600"
          />
          <QuickActionCard
            icon={<Stethoscope className="w-6 h-6" />}
            title="Stetoscopio Digitale"
            description="Auscultazione cardiaca"
            href="/dashboard/stetoscopio"
            color="from-blue-500 to-cyan-600"
          />
          <QuickActionCard
            icon={<Eye className="w-6 h-6" />}
            title="Otoscopio Digitale"
            description="Ispezione orecchie"
            href="/dashboard/otoscopio"
            color="from-purple-500 to-indigo-600"
          />
        </div>

        {/* Info Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">
            🚀 Benvenuto in LINKTOP Health Monitor
          </h2>
          <p className="text-gray-300 mb-4">
            Sistema di monitoraggio integrato per dispositivi medici LINKTOP.
            Gestisci pazienti, esegui misurazioni e monitora lo stato di salute in tempo reale.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              title="6-in-1 Health Monitor"
              features={['SpO2', 'Heart Rate', 'Blood Pressure', 'Temperature', 'ECG', 'Step Counter']}
            />
            <FeatureCard
              title="Digital Stethoscope"
              features={['Auscultazione', 'Registrazione Audio', 'Analisi Suoni', 'Condivisione']}
            />
            <FeatureCard
              title="Digital Otoscope"
              features={['Ispezione Visiva', 'Cattura Immagini', 'Zoom Digitale', 'LED Integrato']}
            />
          </div>
        </div>
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
      className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-emerald-500/50 transition-all group"
    >
      <div className={`w-12 h-12 bg-gradient-to-r ${color} rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </a>
  )
}

function FeatureCard({ title, features }: { title: string; features: string[] }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <h3 className="text-white font-semibold mb-3">{title}</h3>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="text-gray-400 text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}
