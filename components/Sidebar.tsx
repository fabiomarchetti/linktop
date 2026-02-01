"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Users,
  Heart,
  Stethoscope,
  Eye,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  UserPlus,
  User,
  FileText,
  ScrollText,
  Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  dividerAfter?: boolean;
  allowedRoles?: string[]; // Lista dei ruoli che possono vedere questa voce
}

const menuItems: MenuItem[] = [
  {
    icon: <Home className="w-5 h-5" />,
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    icon: <Bell className="w-5 h-5" />,
    label: "Alert",
    href: "/dashboard/alerts",
    dividerAfter: true,
    allowedRoles: ["sviluppatore", "animatore_digitale", "assistente_control_room"],
  },
  {
    icon: <UserPlus className="w-5 h-5" />,
    label: "Gestione Staff",
    href: "/dashboard/users",
    dividerAfter: true,
    allowedRoles: ["sviluppatore"], // Solo lo sviluppatore può vedere questa voce
  },
  {
    icon: <Heart className="w-5 h-5" />,
    label: "Health Monitor",
    href: "/dashboard/health-monitor",
    allowedRoles: ["sviluppatore", "animatore_digitale", "controllo_parentale", "utente_base"], // Escluso assistente_control_room
  },
  {
    icon: <Stethoscope className="w-5 h-5" />,
    label: "Stetoscopio",
    href: "/dashboard/stetoscopio",
    allowedRoles: ["sviluppatore", "animatore_digitale", "controllo_parentale", "utente_base"], // Escluso assistente_control_room
  },
  {
    icon: <Eye className="w-5 h-5" />,
    label: "Otoscopio",
    href: "/dashboard/otoscopio",
    dividerAfter: true,
    allowedRoles: ["sviluppatore", "animatore_digitale", "controllo_parentale", "utente_base"], // Escluso assistente_control_room
  },
  {
    icon: <Users className="w-5 h-5" />,
    label: "Pazienti",
    href: "/dashboard/pazienti",
  },
  {
    icon: <Settings className="w-5 h-5" />,
    label: "Soglie Alert",
    href: "/dashboard/soglie",
    allowedRoles: ["sviluppatore", "animatore_digitale"],
  },
  {
    icon: <Activity className="w-5 h-5" />,
    label: "Pazienti-Dispositivi",
    href: "/dashboard/pazienti-dispositivi",
    dividerAfter: true,
  },
  {
    icon: <User className="w-5 h-5" />,
    label: "Pagina Utente",
    href: "/utente",
    allowedRoles: ["sviluppatore", "animatore_digitale", "controllo_parentale", "utente_base"], // Escluso assistente_control_room
  },
  {
    icon: <FileText className="w-5 h-5" />,
    label: "Documenti",
    href: "/dashboard/documenti",
    allowedRoles: ["sviluppatore", "animatore_digitale", "controllo_parentale", "utente_base"], // Escluso assistente_control_room
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    label: "Statistiche",
    href: "/dashboard/statistiche",
  },
  {
    icon: <ScrollText className="w-5 h-5" />,
    label: "Logs accessi",
    href: "/dashboard/logs",
    allowedRoles: ["sviluppatore"], // Solo sviluppatore può vedere i log
  },
];

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Chiuso di default su mobile
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Gestisce resize e imposta stato iniziale
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      // Su desktop, sidebar aperta di default
      if (!mobile) {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Chiudi sidebar quando si cambia pagina su mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  if (!user) return null;

  // Filtra i menu items in base al ruolo dell'utente
  const filteredMenuItems = menuItems.filter(item => {
    // Se non ci sono ruoli specificati, la voce è visibile a tutti
    if (!item.allowedRoles || item.allowedRoles.length === 0) {
      return true;
    }
    // Altrimenti verifica se il ruolo dell'utente è nella lista dei ruoli permessi
    return item.allowedRoles.includes(user.ruolo);
  });

  return (
    <>
      {/* Mobile Header con Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-white/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Apri menu"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">LINKTOP</span>
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {user.nome.charAt(0)}{user.cognome.charAt(0)}
        </div>
      </div>

      {/* Overlay per mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-slate-900/95 lg:bg-white/5 backdrop-blur-xl border-r border-white/10 transition-all duration-300 z-50 ${
          sidebarOpen
            ? "w-72 lg:w-64 translate-x-0"
            : "-translate-x-full lg:translate-x-0 lg:w-20"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 lg:p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                {(sidebarOpen || isMobile) && (
                  <div>
                    <span className="text-xl font-bold text-white block">
                      LINKTOP
                    </span>
                    <span className="text-xs text-emerald-300">Health Monitor</span>
                  </div>
                )}
              </div>
              {/* Pulsante chiudi solo su mobile */}
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center lg:hidden"
                  aria-label="Chiudi menu"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* User Info */}
          {(sidebarOpen || isMobile) && (
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {user.nome.charAt(0)}
                  {user.cognome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {user.nome} {user.cognome}
                  </p>
                  <p className="text-emerald-300 text-xs truncate">
                    {user.ruolo}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto">
            {filteredMenuItems.map((item, index) => (
              <div key={item.href}>
                <SidebarMenuItem
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  active={pathname === item.href}
                  sidebarOpen={sidebarOpen || isMobile}
                  onClick={() => isMobile && setSidebarOpen(false)}
                />
                {item.dividerAfter && (
                  <div className="my-2 lg:my-3 border-t border-white/10"></div>
                )}
              </div>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="p-3 lg:p-4 border-t border-white/10">
            <button
              onClick={logout}
              className={`w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all flex items-center min-h-[48px] ${
                sidebarOpen || isMobile ? "gap-3" : "justify-center"
              }`}
            >
              <LogOut className="w-5 h-5" />
              {(sidebarOpen || isMobile) && <span className="text-base font-semibold">Esci</span>}
            </button>
          </div>
        </div>

        {/* Toggle Button - Solo desktop */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full items-center justify-center shadow-lg hover:shadow-xl transition-all"
        >
          {sidebarOpen ? (
            <X className="w-4 h-4 text-white" />
          ) : (
            <Menu className="w-4 h-4 text-white" />
          )}
        </button>
      </aside>
    </>
  );
}

function SidebarMenuItem({
  icon,
  label,
  href,
  active = false,
  sidebarOpen,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  sidebarOpen: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[48px] ${
        active
          ? "bg-gradient-to-r from-emerald-500/20 to-teal-600/20 text-white border border-emerald-500/30"
          : "text-gray-400 hover:text-white hover:bg-white/10"
      } ${sidebarOpen ? "" : "justify-center"}`}
    >
      {icon}
      {sidebarOpen && <span className="font-semibold text-base">{label}</span>}
    </Link>
  );
}
