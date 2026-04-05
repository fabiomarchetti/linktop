"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Lock, User, LogIn, AlertCircle } from "lucide-react";

export default function SupervisioneLoginPage() {
  const router = useRouter();
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se c'e' gia' una sessione supervisione, redirect diretto
  useEffect(() => {
    if (typeof window !== "undefined") {
      const session = localStorage.getItem("linktop_supervisione");
      if (session) {
        try {
          const data = JSON.parse(session);
          if (data?.id) {
            router.push(`/supervisione/${data.id}`);
          }
        } catch (e) {
          localStorage.removeItem("linktop_supervisione");
        }
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cfClean = codiceFiscale.trim().toUpperCase().replace(/\s/g, "");

      const res = await fetch("/api/supervisione/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codice_fiscale: cfClean,
          password: password.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Credenziali non valide");
        setLoading(false);
        return;
      }

      // Salva sessione supervisione
      localStorage.setItem("linktop_supervisione", JSON.stringify(data.paziente));

      router.push(`/supervisione/${data.paziente.id}`);
    } catch (err: any) {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-600 via-red-700 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center shadow-2xl border-2 border-white/30 mb-4">
            <MapPin className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white drop-shadow-2xl">
            Supervisione
          </h1>
          <p className="text-white/80 text-sm mt-2">
            Accesso familiari e medici
          </p>
        </div>

        {/* Card Login */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Codice Fiscale */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Codice Fiscale Paziente
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={codiceFiscale}
                  onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                  placeholder="RSSMRA80A01H501Z"
                  maxLength={16}
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none uppercase tracking-wider font-mono text-lg"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="prime 6 lettere del CF"
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Le prime 6 lettere del codice fiscale, in minuscolo
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Accesso in corso...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  ACCEDI
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Torna alla home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
