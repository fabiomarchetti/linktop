"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X, Loader2, MapPin, Clock, Calendar } from "lucide-react";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

interface Position {
  id?: number;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at?: string;
}

interface Props {
  pazienteId: string;
  onClose: () => void;
}

export default function GpsHistoryModal({ pazienteId, onClose }: Props) {
  const [history, setHistory] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/gps/history/${pazienteId}?days=${days}&limit=1000`);
        const json = await res.json();
        if (json.success) {
          setHistory(json.data || []);
        } else {
          setError(json.error || "Errore caricamento");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pazienteId, days]);

  const current = history.length > 0 ? history[0] : null;
  const mapCenter: [number, number] = current
    ? [current.lat, current.lng]
    : [41.9028, 12.4964];

  // Raggruppa per giorno per la lista
  const groupedByDay = history.reduce((acc: Record<string, Position[]>, p) => {
    const day = p.recorded_at
      ? new Date(p.recorded_at).toLocaleDateString("it-IT")
      : "Sconosciuto";
    if (!acc[day]) acc[day] = [];
    acc[day].push(p);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div>
            <h2 className="text-2xl font-bold text-orange-600 flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              Percorso GPS
            </h2>
            <p className="text-sm text-gray-500">
              {history.length} posizioni registrate negli ultimi {days} giorni
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value={1}>Oggi</option>
              <option value={3}>Ultimi 3 giorni</option>
              <option value={7}>Ultimi 7 giorni</option>
              <option value={30}>Ultimi 30 giorni</option>
            </select>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body: mappa + lista */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Mappa */}
          <div className="flex-1 h-[400px] md:h-auto relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="text-red-600 bg-red-50 rounded-lg p-4">{error}</div>
              </div>
            ) : history.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-500">Nessuna posizione registrata</p>
              </div>
            ) : (
              <MapView
                center={mapCenter}
                currentPosition={current}
                history={history}
                geofences={[]}
              />
            )}
          </div>

          {/* Lista cronologica */}
          <aside className="md:w-80 border-l border-gray-200 overflow-y-auto max-h-[400px] md:max-h-none bg-gray-50">
            <div className="p-3">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4" />
                Cronologia
              </h3>
              {Object.entries(groupedByDay).map(([day, positions]) => (
                <div key={day} className="mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2 sticky top-0 bg-gray-50 py-1">
                    <Calendar className="w-3 h-3" />
                    {day}
                  </div>
                  <div className="space-y-1">
                    {positions.map((p, idx) => {
                      const time = p.recorded_at
                        ? new Date(p.recorded_at).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--";
                      const isCurrent = p.id === current?.id;
                      return (
                        <div
                          key={p.id ?? idx}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                            isCurrent ? "bg-green-100 border border-green-300" : "bg-white"
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isCurrent ? "bg-green-500" : "bg-blue-500"
                            }`}
                          />
                          <span className="font-bold">{time}</span>
                          {p.accuracy && (
                            <span className="text-gray-400 ml-auto">
                              ±{Math.round(p.accuracy)}m
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
