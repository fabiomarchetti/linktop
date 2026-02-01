"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Heart, Lock, User, LogIn, AlertCircle, Download, Maximize2, Minimize2 } from "lucide-react";

export default function UtenteLoginPage() {
  const router = useRouter();
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberCF, setRememberCF] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Gestione fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // Listener per cambio stato fullscreen (es. ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  // Carica codice fiscale salvato
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCF = sessionStorage.getItem("linktop_cf");
      if (savedCF) {
        setCodiceFiscale(savedCF);
      }

      // Registra service worker per PWA
      if ("serviceWorker" in navigator) {
        if (process.env.NODE_ENV === "production") {
          navigator.serviceWorker.register("/sw.js").catch((err) => {
            console.error("Service worker registration failed:", err);
          });
        } else {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => registration.unregister());
          });
          if ("caches" in window) {
            caches
              .keys()
              .then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
          }
        }
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/utente/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codice_fiscale: codiceFiscale.toUpperCase(),
          password: password.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (data.success && data.utente) {
        // Salva dati utente in sessionStorage
        sessionStorage.setItem("linktop_utente", JSON.stringify(data.utente));

        // Salva CF se richiesto
        if (rememberCF) {
          sessionStorage.setItem("linktop_cf", codiceFiscale.toUpperCase());
        } else {
          sessionStorage.removeItem("linktop_cf");
        }

        // Vai alla pagina principale
        router.push("/utente/home");
      } else {
        setError(data.error || "Credenziali non valide");
      }
    } catch (error) {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-teal-600 via-emerald-700 to-green-800 flex items-center justify-center p-2 sm:p-4 relative overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-2 right-2 z-20 p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 backdrop-blur-lg rounded-full transition-all border border-white/30"
        title={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        ) : (
          <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        )}
      </button>

      {/* Login Card - Ottimizzato per tablet e T20 Mini (600x960) */}
      <div className="relative z-10 w-full max-w-3xl">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-6 md:p-8">
          {/* Logo compatto */}
          <div className="text-center mb-3 sm:mb-5">
            <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg mb-2">
              <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-0.5">
              Monitoraggio Salute
            </h1>
            <p className="text-teal-100 text-sm sm:text-base">Health Monitor</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-3 p-2.5 bg-red-500/20 border border-red-400/30 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-300 flex-shrink-0" />
              <p className="text-red-100 font-semibold text-sm sm:text-base">{error}</p>
            </div>
          )}

          {/* Login Form - Layout orizzontale su tablet */}
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Codice Fiscale */}
              <div>
                <label className="block text-white text-base sm:text-lg font-semibold mb-1.5">
                  Codice Fiscale
                </label>
                <div className="relative">
                  <User className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-teal-300" />
                  <input
                    type="text"
                    value={codiceFiscale}
                    onChange={(e) =>
                      setCodiceFiscale(e.target.value.toUpperCase())
                    }
                    maxLength={16}
                    required
                    className="w-full pl-10 sm:pl-12 pr-3 py-3 sm:py-4 text-base sm:text-lg bg-white/20 border-2 border-white/30 rounded-xl sm:rounded-2xl text-white placeholder-white/60 focus:outline-none focus:border-teal-300 focus:bg-white/25 transition-all uppercase"
                    placeholder="RSSMRA80A01H501X"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-white text-base sm:text-lg font-semibold mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-teal-300" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.toLowerCase())}
                    required
                    className="w-full pl-10 sm:pl-12 pr-3 py-3 sm:py-4 text-base sm:text-lg bg-white/20 border-2 border-white/30 rounded-xl sm:rounded-2xl text-white placeholder-white/60 focus:outline-none focus:border-teal-300 focus:bg-white/25 transition-all lowercase"
                    placeholder="••••••"
                    autoComplete="off"
                  />
                </div>
                <p className="text-teal-100 text-[10px] sm:text-xs mt-0.5">
                  Prime 6 lettere del CF
                </p>
              </div>
            </div>

            {/* Remember CF */}
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="checkbox"
                id="remember"
                checked={rememberCF}
                onChange={(e) => setRememberCF(e.target.checked)}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-2 border-white/30 bg-white/20 text-teal-500 focus:ring-2 focus:ring-teal-300"
              />
              <label htmlFor="remember" className="text-white text-sm sm:text-base">
                Ricorda il mio codice fiscale
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold text-lg sm:text-xl shadow-lg hover:shadow-xl hover:from-teal-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-5 h-5 sm:w-6 sm:h-6" />
                  Accedi
                </>
              )}
            </button>
          </form>

          {/* Help Text compatto */}
          <div className="mt-2 sm:mt-4 text-center text-white/80 text-[11px] sm:text-sm">
            <p>Non ricordi la password? Contatta il tuo operatore sanitario</p>
          </div>
        </div>

        {/* Install PWA Hint */}
        {deferredPrompt && (
          <div className="mt-3 sm:mt-6 flex justify-center">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 backdrop-blur-sm transition-all shadow-lg hover:shadow-xl font-medium text-sm sm:text-base"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              scarica l'applicazione
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
