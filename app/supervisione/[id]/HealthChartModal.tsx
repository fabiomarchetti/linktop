"use client";

import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type MetricType = "spo2" | "heart_rate" | "temperature" | "blood_pressure";

interface Props {
  pazienteId: string;
  metric: MetricType;
  title: string;
  unit: string;
  color: string;
  normalRange?: { min: number; max: number };
  onClose: () => void;
}

interface DataPoint {
  recorded_at: string;
  spo2?: number;
  heart_rate?: number;
  temperature?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
}

export default function HealthChartModal({
  pazienteId, metric, title, unit, color, normalRange, onClose,
}: Props) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `/api/health-data?type=${metric}&paziente_id=${pazienteId}&limit=100`
        );
        const json = await res.json();
        if (json.success) {
          // Inverti per avere tempo crescente nel grafico
          setData((json.data || []).reverse());
        } else {
          setError(json.error || "Errore caricamento dati");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [metric, pazienteId]);

  // Estrae il valore numerico dal record in base al tipo metrica
  const chartData = data.map((d) => {
    const date = new Date(d.recorded_at);
    const label = date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (metric === "blood_pressure") {
      return {
        label,
        sistolica: d.systolic_bp,
        diastolica: d.diastolic_bp,
        raw: d.recorded_at,
      };
    }
    let value: number | undefined;
    if (metric === "spo2") value = d.spo2;
    else if (metric === "heart_rate") value = d.heart_rate;
    else if (metric === "temperature") value = d.temperature ? parseFloat(String(d.temperature)) : undefined;
    return { label, value, raw: d.recorded_at };
  });

  // Statistiche
  const values = metric === "blood_pressure"
    ? chartData.map((d: any) => d.sistolica).filter((v: any) => v != null)
    : chartData.map((d: any) => d.value).filter((v: any) => v != null);

  const stats = values.length > 0
    ? {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
        last: values[values.length - 1],
        first: values[0],
      }
    : null;

  const trend = stats
    ? stats.last > stats.first ? "up"
    : stats.last < stats.first ? "down"
    : "stable"
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-2xl font-bold" style={{ color }}>{title}</h2>
            <p className="text-sm text-gray-500">Storico ultimi {data.length} rilevamenti</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color }} />
            </div>
          ) : error ? (
            <div className="text-red-600 p-4 bg-red-50 rounded-lg">{error}</div>
          ) : data.length === 0 ? (
            <div className="text-gray-500 p-8 text-center">
              Nessun dato disponibile
            </div>
          ) : (
            <>
              {/* Statistiche */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <StatBox label="Minimo" value={stats.min} unit={unit} color="text-blue-600" />
                  <StatBox label="Massimo" value={stats.max} unit={unit} color="text-red-600" />
                  <StatBox label="Media" value={stats.avg} unit={unit} color="text-purple-600" />
                  <StatBox
                    label="Attuale"
                    value={stats.last}
                    unit={unit}
                    color={
                      normalRange && (stats.last < normalRange.min || stats.last > normalRange.max)
                        ? "text-red-600"
                        : "text-green-600"
                    }
                    icon={
                      trend === "up" ? <TrendingUp className="w-4 h-4" /> :
                      trend === "down" ? <TrendingDown className="w-4 h-4" /> :
                      <Minus className="w-4 h-4" />
                    }
                  />
                </div>
              )}

              {/* Grafico */}
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      domain={
                        metric === "spo2" ? [85, 100] :
                        metric === "temperature" ? ["dataMin - 0.5", "dataMax + 0.5"] :
                        ["dataMin - 5", "dataMax + 5"]
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    {/* Linea normale range */}
                    {normalRange && (
                      <>
                        <ReferenceLine y={normalRange.min} stroke="#10b981" strokeDasharray="5 5" label={{ value: "Min normale", fontSize: 10, position: "insideLeft" }} />
                        <ReferenceLine y={normalRange.max} stroke="#10b981" strokeDasharray="5 5" label={{ value: "Max normale", fontSize: 10, position: "insideLeft" }} />
                      </>
                    )}

                    {metric === "blood_pressure" ? (
                      <>
                        <Line type="monotone" dataKey="sistolica" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="Sistolica" />
                        <Line type="monotone" dataKey="diastolica" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Diastolica" />
                      </>
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: color }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label, value, unit, color, icon,
}: {
  label: string; value: number | string; unit: string; color: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold flex items-center gap-1 ${color}`}>
        {value}
        <span className="text-xs font-normal">{unit}</span>
        {icon && <span className="ml-1">{icon}</span>}
      </div>
    </div>
  );
}
