"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  MapPin, LogOut, Heart, Activity, Thermometer, Droplet,
  RefreshCw, Loader2, Navigation, Circle as CircleIcon, Trash2, AlertCircle, TrendingUp, Clock, Video, PhoneOff,
} from "lucide-react";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
import HealthChartModal from "./HealthChartModal";
import GpsHistoryModal from "./GpsHistoryModal";

type MetricType = "spo2" | "heart_rate" | "temperature" | "blood_pressure";

interface Paziente {
  id: number;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  data_nascita?: string;
  telefono?: string;
  emergenza_nome?: string | null;
  emergenza_telefono?: string | null;
  emergenza_email?: string | null;
  emergenza_relazione?: string | null;
  emergenza2_nome?: string | null;
  emergenza2_telefono?: string | null;
  emergenza2_email?: string | null;
  emergenza2_relazione?: string | null;
  last_heart_rate?: number;
  last_spo2?: number;
  last_temperature?: number;
  last_systolic_bp?: number;
  last_diastolic_bp?: number;
  last_heart_rate_time?: string;
  last_spo2_time?: string;
  last_temperature_time?: string;
  last_bp_time?: string;
}

interface Position {
  id?: number;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at?: string;
}

interface Geofence {
  id: number;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  type: string;
}

export default function SupervisionePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [paziente, setPaziente] = useState<Paziente | null>(null);
  const [currentPos, setCurrentPos] = useState<Position | null>(null);
  const [history, setHistory] = useState<Position[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingPosition, setRequestingPosition] = useState(false);
  const [requestingRing, setRequestingRing] = useState(false);
  const [autoMeasureInterval, setAutoMeasureInterval] = useState<number | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Videochiamata
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [videoCallData, setVideoCallData] = useState<{ roomName: string; jwt: string; appId: string } | null>(null);

  // Drawing geofence
  const [drawingMode, setDrawingMode] = useState(false);
  const [draftGeofence, setDraftGeofence] = useState<{ center: [number, number]; radius: number } | null>(null);
  const [geofenceName, setGeofenceName] = useState("");

  // Modal grafico salute
  const [chartMetric, setChartMetric] = useState<MetricType | null>(null);

  // Modal storico GPS
  const [showGpsHistory, setShowGpsHistory] = useState(false);

  // Quali contatti emergenza notificare: 'emergenza' | 'emergenza2' | 'both' | 'none'
  const [notifyContacts, setNotifyContacts] = useState<string>("both");

  // Verifica sessione supervisione
  useEffect(() => {
    const session = localStorage.getItem("linktop_supervisione");
    if (!session) {
      router.push("/supervisione");
      return;
    }
    try {
      const data = JSON.parse(session);
      if (!data?.id || String(data.id) !== String(id)) {
        router.push("/supervisione");
        return;
      }
    } catch {
      router.push("/supervisione");
    }
  }, [id, router]);

  // Carica dati
  const loadData = useCallback(async () => {
    try {
      const [pRes, latestRes, histRes, geoRes, schedRes] = await Promise.all([
        fetch(`/api/pazienti/${id}`),
        fetch(`/api/gps/latest/${id}`),
        fetch(`/api/gps/history/${id}?days=7`),
        fetch(`/api/geofences/${id}`),
        fetch(`/api/health/schedule/${id}`),
      ]);

      if (pRes.ok) {
        const d = await pRes.json();
        if (d.success) setPaziente(d.paziente);
      }

      if (latestRes.ok) {
        const d = await latestRes.json();
        if (d.success && d.data) setCurrentPos(d.data);
      }

      if (histRes.ok) {
        const d = await histRes.json();
        if (d.success) setHistory(d.data);
      }

      if (geoRes.ok) {
        const d = await geoRes.json();
        if (d.success) setGeofences(d.data);
      }

      if (schedRes.ok) {
        const d = await schedRes.json();
        if (d.success) setAutoMeasureInterval(d.interval_minutes ?? null);
      }
    } catch (e: any) {
      console.error('Errore caricamento dati:', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    // Refresh automatico ogni 30 secondi
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleLogout = () => {
    localStorage.removeItem("linktop_supervisione");
    router.push("/");
  };

  const handleRequestPosition = async () => {
    setRequestingPosition(true);
    try {
      const res = await fetch(`/api/gps/request-position/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_by: "supervisione" }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("Errore: " + (data.error || "impossibile inviare comando"));
        setRequestingPosition(false);
        return;
      }

      // Polling per 30 secondi in attesa della risposta
      const commandId = data.command_id;
      let attempts = 0;
      const maxAttempts = 30;

      const poll = setInterval(async () => {
        attempts++;
        const r = await fetch(`/api/gps/request-position/${id}?command_id=${commandId}`);
        const d = await r.json();
        if (d.success && d.data?.status === "completed") {
          clearInterval(poll);
          setRequestingPosition(false);
          await loadData();
        } else if (attempts >= maxAttempts || d.data?.status === "failed") {
          clearInterval(poll);
          setRequestingPosition(false);
          alert("Il dispositivo non ha risposto. Riprova.");
        }
      }, 1000);
    } catch (e: any) {
      setRequestingPosition(false);
      alert("Errore: " + e.message);
    }
  };

  const handleRequestRing = async () => {
    setRequestingRing(true);
    try {
      const res = await fetch(`/api/health/request-ring/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!data.success) {
        alert("Errore: " + (data.error || "impossibile inviare comando"));
        setRequestingRing(false);
        return;
      }

      // Polling fino a 5 minuti (connessione ~5s + HR 30s + SpO2 35s + margine)
      const commandId = data.command_id;
      let attempts = 0;
      const maxAttempts = 300;

      const poll = setInterval(async () => {
        attempts++;
        const r = await fetch(`/api/health/request-ring/${id}?command_id=${commandId}`);
        const d = await r.json();
        if (d.success && d.data?.status === "completed") {
          clearInterval(poll);
          setRequestingRing(false);
          await loadData();
        } else if (attempts >= maxAttempts || d.data?.status === "failed") {
          clearInterval(poll);
          setRequestingRing(false);
          if (d.data?.status === "failed") {
            alert("Misurazione fallita. Assicurarsi che l'anello sia indossato e riprova.");
          } else {
            alert("Timeout: il dispositivo non ha risposto entro 5 minuti. Riprova.");
          }
        }
      }, 1000);
    } catch (e: any) {
      setRequestingRing(false);
      alert("Errore: " + e.message);
    }
  };

  const handleStartVideoCall = async () => {
    try {
      const session = localStorage.getItem("linktop_supervisione");
      const nomeOperatore = session ? JSON.parse(session)?.nome || "Familiare" : "Familiare";
      const res = await fetch(`/api/video/call/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_operatore: nomeOperatore }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("Errore avvio videochiamata: " + data.error);
        return;
      }
      setVideoCallData({ roomName: data.room_name, jwt: data.jwt_moderator, appId: data.jaas_app_id });
      setVideoCallActive(true);
    } catch (e: any) {
      alert("Errore: " + e.message);
    }
  };

  const handleEndVideoCall = async () => {
    setVideoCallActive(false);
    setVideoCallData(null);
    await fetch(`/api/video/call/${id}`, { method: "DELETE" });
  };

  const handleScheduleChange = async (value: string) => {
    const interval = value === "" ? null : parseInt(value);
    setSavingSchedule(true);
    try {
      const res = await fetch(`/api/health/schedule/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_minutes: interval }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoMeasureInterval(interval);
      } else {
        alert("Errore salvataggio: " + data.error);
      }
    } catch (e: any) {
      alert("Errore: " + e.message);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDrawUpdate = (center: [number, number], radius: number) => {
    setDraftGeofence({ center, radius });
  };

  const handleDrawComplete = () => {
    // Il drag e' finito, aspettiamo che l'utente dia nome e clicchi Salva
  };

  const handleSaveGeofence = async () => {
    if (!draftGeofence || !geofenceName.trim()) {
      alert("Inserisci un nome per la zona");
      return;
    }
    try {
      const res = await fetch(`/api/geofences/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: geofenceName.trim(),
          center_lat: draftGeofence.center[0],
          center_lng: draftGeofence.center[1],
          radius_meters: draftGeofence.radius,
          type: "safe",
          created_by: "supervisione",
          notify_contacts: notifyContacts,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDrawingMode(false);
        setDraftGeofence(null);
        setGeofenceName("");
        setNotifyContacts("both");
        await loadData();
      } else {
        alert("Errore: " + data.error);
      }
    } catch (e: any) {
      alert("Errore: " + e.message);
    }
  };

  const handleDeleteGeofence = async (geofenceId: number) => {
    if (!confirm("Eliminare questa zona?")) return;
    await fetch(`/api/geofences/${id}?id=${geofenceId}`, { method: "DELETE" });
    await loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  const mapCenter: [number, number] = currentPos
    ? [currentPos.lat, currentPos.lng]
    : [41.9028, 12.4964]; // Roma default

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">
                {paziente ? `${paziente.nome} ${paziente.cognome}` : "Supervisione"}
              </h1>
              <p className="text-xs text-gray-500">CF: {paziente?.codice_fiscale}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Esci
          </button>
        </div>
      </header>

      <main className="w-full px-4 py-4">
        {/* Layout 2 colonne: parametri salute a sinistra + mappa a destra */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Colonna sinistra: parametri salute */}
          <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-3">
            <HealthCard
              icon={<Droplet className="w-5 h-5" />}
              label="Ossigeno"
              value={paziente?.last_spo2 ? `${paziente.last_spo2}%` : "--"}
              time={paziente?.last_spo2_time}
              color="blue"
              onClick={() => setChartMetric("spo2")}
            />
            <HealthCard
              icon={<Heart className="w-5 h-5" />}
              label="Battito"
              value={paziente?.last_heart_rate ? `${paziente.last_heart_rate}` : "--"}
              unit="bpm"
              time={paziente?.last_heart_rate_time}
              color="red"
              onClick={() => setChartMetric("heart_rate")}
            />
            <HealthCard
              icon={<Thermometer className="w-5 h-5" />}
              label="Temperatura"
              value={paziente?.last_temperature ? `${paziente.last_temperature}°` : "--"}
              time={paziente?.last_temperature_time}
              color="orange"
              onClick={() => setChartMetric("temperature")}
            />
            <HealthCard
              icon={<Activity className="w-5 h-5" />}
              label="Pressione"
              value={
                paziente?.last_systolic_bp && paziente?.last_diastolic_bp
                  ? `${paziente.last_systolic_bp}/${paziente.last_diastolic_bp}`
                  : "--"
              }
              time={paziente?.last_bp_time}
              color="purple"
              onClick={() => setChartMetric("blood_pressure")}
            />

            {/* Bottone videochiamata */}
            <button
              onClick={handleStartVideoCall}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-md hover:from-green-600 hover:to-emerald-700 transition-all"
            >
              <Video className="w-4 h-4" /> Videochiama
            </button>

            {/* Bottone misura anello */}
            <button
              onClick={handleRequestRing}
              disabled={requestingRing}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold rounded-xl shadow-md disabled:opacity-50 hover:from-purple-600 hover:to-violet-700 transition-all"
            >
              {requestingRing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Attesa anello...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" /> Misura Anello
                </>
              )}
            </button>

            {/* Misurazione automatica */}
            <div className="bg-white rounded-xl shadow-md p-3">
              <h2 className="font-bold text-sm mb-2 flex items-center gap-1 text-purple-700">
                <Activity className="w-4 h-4" />
                Misura automatica
              </h2>
              <select
                value={autoMeasureInterval ?? ""}
                onChange={(e) => handleScheduleChange(e.target.value)}
                disabled={savingSchedule}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
              >
                <option value="">Disattivata</option>
                <option value="5">Ogni 5 minuti</option>
                <option value="15">Ogni 15 minuti</option>
                <option value="30">Ogni 30 minuti</option>
                <option value="60">Ogni ora</option>
                <option value="120">Ogni 2 ore</option>
                <option value="300">Ogni 5 ore</option>
                <option value="720">Ogni 12 ore</option>
                <option value="1440">Ogni 24 ore</option>
              </select>
              {autoMeasureInterval && (
                <p className="text-xs text-purple-600 mt-1">
                  ✓ Attiva — prossima misura entro {autoMeasureInterval >= 60
                    ? `${autoMeasureInterval / 60}h`
                    : `${autoMeasureInterval}min`}
                </p>
              )}
            </div>

            {/* Zone definite */}
            {geofences.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-3 mt-3">
                <h2 className="font-bold text-sm mb-2 flex items-center gap-1">
                  <CircleIcon className="w-4 h-4 text-orange-600" />
                  Zone ({geofences.length})
                </h2>
                <div className="space-y-2">
                  {geofences.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <CircleIcon className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate">{g.name}</p>
                          <p className="text-xs text-gray-500">
                            {g.radius_meters}m
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteGeofence(g.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Colonna destra: mappa + controlli (occupa tutto lo spazio rimanente) */}
          <div className="flex-1 min-w-0 space-y-4">

        {/* Modal grafico storico */}
        {chartMetric && paziente && (
          <HealthChartModal
            pazienteId={String(paziente.id)}
            metric={chartMetric}
            title={
              chartMetric === "spo2" ? "Ossigeno (SpO2)" :
              chartMetric === "heart_rate" ? "Battito cardiaco" :
              chartMetric === "temperature" ? "Temperatura" :
              "Pressione arteriosa"
            }
            unit={
              chartMetric === "spo2" ? "%" :
              chartMetric === "heart_rate" ? "bpm" :
              chartMetric === "temperature" ? "°C" :
              "mmHg"
            }
            color={
              chartMetric === "spo2" ? "#2563eb" :
              chartMetric === "heart_rate" ? "#dc2626" :
              chartMetric === "temperature" ? "#ea580c" :
              "#9333ea"
            }
            normalRange={
              chartMetric === "spo2" ? { min: 95, max: 100 } :
              chartMetric === "heart_rate" ? { min: 60, max: 100 } :
              chartMetric === "temperature" ? { min: 36, max: 37.5 } :
              chartMetric === "blood_pressure" ? { min: 90, max: 140 } :
              undefined
            }
            onClose={() => setChartMetric(null)}
          />
        )}

        {/* Mappa + controlli */}
        <section className="bg-white rounded-xl shadow-md p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Navigation className="w-5 h-5 text-orange-600" />
              Posizione GPS
            </h2>
            <div className="flex gap-2">
              <button
                onClick={loadData}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna
              </button>
              <button
                onClick={handleRequestPosition}
                disabled={requestingPosition}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg disabled:opacity-50"
              >
                {requestingPosition ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Attesa...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" /> Richiedi posizione ora
                  </>
                )}
              </button>
              <button
                onClick={() => setShowGpsHistory(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg"
              >
                <Clock className="w-4 h-4" />
                Storico percorsi
              </button>
              <button
                onClick={() => {
                  setDrawingMode(!drawingMode);
                  setDraftGeofence(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-lg ${
                  drawingMode ? "bg-red-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <CircleIcon className="w-4 h-4" />
                {drawingMode ? "Annulla" : "Disegna zona"}
              </button>
            </div>
          </div>

          {/* Modal storico GPS */}
          {showGpsHistory && (
            <GpsHistoryModal
              pazienteId={String(id)}
              onClose={() => setShowGpsHistory(false)}
            />
          )}


          {currentPos ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <MapPin className="w-4 h-4" />
              Ultima posizione: {new Date(currentPos.recorded_at!).toLocaleString("it-IT")}
              {currentPos.accuracy && <span> (±{Math.round(currentPos.accuracy)}m)</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Nessuna posizione disponibile. Clicca "Richiedi posizione ora".
              </span>
            </div>
          )}

          {drawingMode && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 space-y-2">
              <p className="text-sm font-bold text-orange-900">
                Clicca e trascina sulla mappa dal centro verso l'esterno per disegnare il cerchio.
              </p>
              {draftGeofence && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Nome zona (es. Casa)"
                      value={geofenceName}
                      onChange={(e) => setGeofenceName(e.target.value)}
                      className="flex-1 min-w-[150px] px-3 py-1.5 border rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      min={20}
                      max={5000}
                      step={10}
                      value={draftGeofence.radius}
                      onChange={(e) =>
                        setDraftGeofence({ ...draftGeofence, radius: parseInt(e.target.value) || 100 })
                      }
                      className="w-24 px-3 py-1.5 border rounded-lg text-sm"
                    />
                    <span className="text-sm text-gray-600">metri</span>
                    <button
                      onClick={handleSaveGeofence}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-bold rounded-lg"
                    >
                      Salva
                    </button>
                  </div>

                  {/* Dropdown contatti emergenza da notificare */}
                  <div>
                    <p className="text-xs font-bold text-orange-900 mb-1">
                      Avvisa quando esce dalla zona:
                    </p>
                    {!paziente?.emergenza_email && !paziente?.emergenza2_email ? (
                      <div className="text-xs text-gray-600 bg-white p-2 rounded-lg">
                        Nessun contatto di emergenza configurato per il paziente.
                        Va aggiunto dalla pagina Pazienti (email obbligatoria).
                      </div>
                    ) : (
                      <select
                        value={notifyContacts}
                        onChange={(e) => setNotifyContacts(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                      >
                        {paziente.emergenza_email && paziente.emergenza2_email && (
                          <option value="both">
                            Entrambi i contatti di emergenza
                          </option>
                        )}
                        {paziente.emergenza_email && (
                          <option value="emergenza">
                            {paziente.emergenza_nome || "Contatto 1"}{" "}
                            {paziente.emergenza_relazione && `(${paziente.emergenza_relazione})`}
                          </option>
                        )}
                        {paziente.emergenza2_email && (
                          <option value="emergenza2">
                            {paziente.emergenza2_nome || "Contatto 2"}{" "}
                            {paziente.emergenza2_relazione && `(${paziente.emergenza2_relazione})`}
                          </option>
                        )}
                        <option value="none">Nessun avviso</option>
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mappa */}
          <div className="h-[calc(100vh-200px)] min-h-[500px] rounded-lg overflow-hidden border-2 border-gray-200">
            <MapView
              center={mapCenter}
              currentPosition={currentPos}
              history={history}
              geofences={geofences}
              drawingMode={draftGeofence}
              isDrawingActive={drawingMode}
              onDrawUpdate={handleDrawUpdate}
              onDrawComplete={handleDrawComplete}
            />
          </div>
        </section>

          </div>
          {/* Fine colonna destra */}
        </div>
        {/* Fine layout 2 colonne */}
      </main>

      {/* Modal videochiamata */}
      {videoCallActive && videoCallData && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
            <span className="text-white font-bold flex items-center gap-2">
              <Video className="w-5 h-5 text-green-400" />
              Videochiamata in corso
            </span>
            <button
              onClick={handleEndVideoCall}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
            >
              <PhoneOff className="w-4 h-4" /> Termina
            </button>
          </div>
          <div className="flex-1">
            <JitsiFrame
              appId={videoCallData.appId}
              roomName={videoCallData.roomName}
              jwt={videoCallData.jwt}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function JitsiFrame({ appId, roomName, jwt }: {
  appId: string; roomName: string; jwt: string;
}) {
  const url = `https://8x8.vc/${appId}/${roomName}?jwt=${jwt}`;
  return (
    <iframe
      src={url}
      allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write"
      style={{ width: "100%", height: "100%", border: "none" }}
      title="Videochiamata"
    />
  );
}

function HealthCard({
  icon, label, value, unit, time, color, onClick,
}: {
  icon: React.ReactNode; label: string; value: string; unit?: string;
  time?: string; color: string; onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    blue: "from-blue-500 to-cyan-500",
    red: "from-red-500 to-pink-500",
    orange: "from-orange-500 to-yellow-500",
    purple: "from-purple-500 to-violet-500",
  };
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl shadow-md p-3 text-left hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 bg-gradient-to-br ${colors[color]} rounded-full flex items-center justify-center text-white`}>
          {icon}
        </div>
        <span className="text-xs font-bold text-gray-600">{label}</span>
        <TrendingUp className="w-3 h-3 text-gray-400 ml-auto" />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-black">{value}</span>
        {unit && <span className="text-xs text-gray-500 mb-1">{unit}</span>}
      </div>
      {time && (
        <p className="text-xs text-gray-400 mt-1">
          {new Date(time).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
    </button>
  );
}
