"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef } from "react";

// Fix icone Leaflet su Next.js
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

interface MapViewProps {
  center: [number, number];
  currentPosition?: Position | null;
  history: Position[];
  geofences: Geofence[];
  drawingMode?: { center: [number, number]; radius: number } | null;
  isDrawingActive?: boolean;
  selectedPosition?: Position | null;
  onMapClick?: (lat: number, lng: number) => void;
  onDrawUpdate?: (center: [number, number], radius: number) => void;
  onDrawComplete?: () => void;
}

// Componente che centra la mappa quando cambia la posizione
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Marker rosso con reverse geocoding e bottoni condivisione
function SelectedPositionMarker({ position }: { position: Position }) {
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAddress(null);
    setLoadingAddr(true);
    setCopied(false);
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "it" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.display_name) {
          setAddress(data.display_name);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAddr(false));
  }, [position.lat, position.lng]);

  const googleMapsUrl = `https://www.google.com/maps?q=${position.lat},${position.lng}`;
  const dateStr = position.recorded_at
    ? new Date(position.recorded_at).toLocaleString("it-IT")
    : "";

  const subject = "Posizione paziente";
  const body =
    `Posizione rilevata il ${dateStr}\n\n` +
    `${address || `Lat: ${position.lat}, Lng: ${position.lng}`}\n\n` +
    `Apri su Google Maps:\n${googleMapsUrl}`;

  const subjectEnc = encodeURIComponent(subject);
  const bodyEnc = encodeURIComponent(body);

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subjectEnc}&body=${bodyEnc}`;
  const mailtoUrl = `mailto:?subject=${subjectEnc}&body=${bodyEnc}`;
  const whatsappUrl = `https://wa.me/?text=${bodyEnc}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={L.divIcon({
        html: '<div style="width:24px;height:24px;background:red;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })}
    >
      <Popup minWidth={260} maxWidth={320}>
        <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
          <strong style={{ color: "red", fontSize: "14px" }}>
            Posizione selezionata
          </strong>
          <br />
          {dateStr && <span style={{ color: "#666" }}>{dateStr}</span>}
          {position.accuracy && (
            <span style={{ color: "#999" }}>
              {" "}
              · ±{Math.round(position.accuracy)}m
            </span>
          )}
          {loadingAddr && (
            <div style={{ color: "#999", marginTop: 4 }}>
              Caricamento indirizzo...
            </div>
          )}
          {address && (
            <div
              style={{
                marginTop: 6,
                padding: "6px 8px",
                background: "#f3f4f6",
                borderRadius: 6,
                fontSize: "12px",
                color: "#333",
              }}
            >
              📍 {address}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                background: "#2563eb",
                color: "white",
                padding: "8px 10px",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              🗺️ Apri su Google Maps
            </a>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <a
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: "block",
                  background: "#dc2626",
                  color: "white",
                  padding: "6px 8px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: "11px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                ✉️ Gmail
              </a>
              <a
                href={mailtoUrl}
                style={{
                  flex: 1,
                  display: "block",
                  background: "#0891b2",
                  color: "white",
                  padding: "6px 8px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: "11px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                📧 Mail
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: "block",
                  background: "#16a34a",
                  color: "white",
                  padding: "6px 8px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: "11px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                💬 WhatsApp
              </a>
            </div>
            <button
              onClick={handleCopy}
              style={{
                width: "100%",
                background: copied ? "#16a34a" : "#6b7280",
                color: "white",
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              {copied ? "✓ Copiato!" : "📋 Copia testo"}
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// Componente che centra la mappa sulla posizione selezionata
function SelectedMarkerRecenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 17);
  }, [position, map]);
  return null;
}

// Componente che gestisce il disegno del cerchio con drag
function DrawHandler({
  isDrawingActive,
  onDrawUpdate,
  onDrawComplete,
}: {
  isDrawingActive?: boolean;
  onDrawUpdate?: (center: [number, number], radius: number) => void;
  onDrawComplete?: () => void;
}) {
  const map = useMap();
  const [drawingCenter, setDrawingCenter] = useState<L.LatLng | null>(null);

  useEffect(() => {
    if (!isDrawingActive) return;

    // Disabilita il drag della mappa durante il disegno
    map.dragging.disable();

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      const center = e.latlng;
      setDrawingCenter(center);
      onDrawUpdate?.([center.lat, center.lng], 50);
    };

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!drawingCenter) return;
      const radius = drawingCenter.distanceTo(e.latlng);
      onDrawUpdate?.([drawingCenter.lat, drawingCenter.lng], Math.max(20, Math.round(radius)));
    };

    const onMouseUp = () => {
      if (drawingCenter) {
        onDrawComplete?.();
      }
      setDrawingCenter(null);
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.dragging.enable();
    };
  }, [isDrawingActive, drawingCenter, map, onDrawUpdate, onDrawComplete]);

  return null;
}

// Chiama OSRM match per snappare il tracciato GPS alle strade reali
async function fetchOsrmRoute(points: Position[]): Promise<[number, number][]> {
  if (points.length < 2) return [];

  // Ordina per data crescente
  const sorted = [...points].sort((a, b) => {
    if (!a.recorded_at || !b.recorded_at) return 0;
    return new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime();
  });

  // Rimuovi outlier GPS: punti oltre 2 km dalla mediana vengono scartati
  const lats = [...sorted].map((p) => p.lat).sort((a, b) => a - b);
  const lngs = [...sorted].map((p) => p.lng).sort((a, b) => a - b);
  const medLat = lats[Math.floor(lats.length / 2)];
  const medLng = lngs[Math.floor(lngs.length / 2)];
  const MAX_DEG = 0.018; // ~2 km in gradi
  const filtered = sorted.filter(
    (p) => Math.abs(p.lat - medLat) < MAX_DEG && Math.abs(p.lng - medLng) < MAX_DEG
  );
  const clean = filtered.length >= 2 ? filtered : sorted;

  // OSRM ha limite 100 waypoints: campiona se necessario
  let sampled = clean;
  if (sorted.length > 100) {
    const step = Math.ceil(sorted.length / 100);
    sampled = sorted.filter((_, i) => i % step === 0);
    // Aggiungi sempre l'ultimo punto
    if (sampled[sampled.length - 1] !== sorted[sorted.length - 1]) {
      sampled.push(sorted[sorted.length - 1]);
    }
  }

  const coords = sampled.map((p) => `${p.lng},${p.lat}`).join(";");
  const timestamps = sampled
    .map((p) => (p.recorded_at ? Math.floor(new Date(p.recorded_at).getTime() / 1000) : null))
    .filter(Boolean)
    .join(";");

  const hasTimestamps = timestamps.split(";").length === sampled.length;
  const url =
    `https://router.project-osrm.org/match/v1/driving/${coords}` +
    `?overview=full&geometries=geojson` +
    (hasTimestamps ? `&timestamps=${timestamps}` : "");

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.matchings && data.matchings.length > 0) {
      return data.matchings.flatMap((m: { geometry: { coordinates: [number, number][] } }) =>
        m.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      );
    }
  } catch {}

  // Fallback: linee rette
  return sampled.map((p) => [p.lat, p.lng] as [number, number]);
}

export default function MapView({
  center,
  currentPosition,
  history,
  geofences,
  drawingMode,
  isDrawingActive,
  selectedPosition,
  onDrawUpdate,
  onDrawComplete,
}: MapViewProps) {
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const prevHistoryRef = useRef<string>("");

  useEffect(() => {
    const key = history.map((p) => p.id ?? `${p.lat},${p.lng}`).join(",");
    if (key === prevHistoryRef.current) return;
    prevHistoryRef.current = key;

    if (history.length < 2) {
      setRouteLine([]);
      return;
    }

    fetchOsrmRoute(history).then(setRouteLine);
  }, [history]);

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapRecenter center={center} />
      <DrawHandler
        isDrawingActive={isDrawingActive}
        onDrawUpdate={onDrawUpdate}
        onDrawComplete={onDrawComplete}
      />

      {/* Storico movimenti (polyline su strada via OSRM) */}
      {routeLine.length > 1 && (
        <Polyline positions={routeLine} color="#3b82f6" weight={2} opacity={0.35} dashArray="6,10" />
      )}

      {/* Marker per ogni posizione storica (esclusa l'ultima che e' "current") */}
      {history.slice(1).map((p, idx) => (
        <CircleMarker
          key={`hist-${p.id ?? idx}`}
          center={[p.lat, p.lng]}
          radius={4}
          pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.7, weight: 1 }}
        >
          <Popup>
            <div className="text-xs">
              <strong>#{history.length - idx - 1}</strong>
              {p.recorded_at && (
                <>
                  <br />
                  {new Date(p.recorded_at).toLocaleString("it-IT")}
                </>
              )}
              {p.accuracy && <><br />±{Math.round(p.accuracy)}m</>}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Posizione corrente (marker verde) */}
      {currentPosition && (
        <>
          <Marker position={[currentPosition.lat, currentPosition.lng]}>
            <Popup>
              <strong>Posizione attuale</strong>
              <br />
              {currentPosition.recorded_at &&
                new Date(currentPosition.recorded_at).toLocaleString("it-IT")}
              {currentPosition.accuracy && (
                <>
                  <br />
                  Precisione: ±{Math.round(currentPosition.accuracy)} m
                </>
              )}
            </Popup>
          </Marker>
          {currentPosition.accuracy && (
            <Circle
              center={[currentPosition.lat, currentPosition.lng]}
              radius={currentPosition.accuracy}
              pathOptions={{ color: "green", fillOpacity: 0.1 }}
            />
          )}
        </>
      )}

      {/* Geofences esistenti */}
      {geofences.map((g) => (
        <Circle
          key={g.id}
          center={[g.center_lat, g.center_lng]}
          radius={g.radius_meters}
          pathOptions={{
            color: g.type === "home" ? "purple" : "orange",
            fillColor: g.type === "home" ? "purple" : "orange",
            fillOpacity: 0.15,
          }}
        >
          <Popup>
            <strong>{g.name}</strong>
            <br />
            Raggio: {g.radius_meters} m
          </Popup>
        </Circle>
      ))}

      {/* Posizione selezionata dalla cronologia (marker rosso grande con indirizzo) */}
      {selectedPosition && (
        <>
          <SelectedMarkerRecenter position={[selectedPosition.lat, selectedPosition.lng]} />
          <SelectedPositionMarker position={selectedPosition} />
          <Circle
            center={[selectedPosition.lat, selectedPosition.lng]}
            radius={selectedPosition.accuracy || 30}
            pathOptions={{ color: "red", fillColor: "red", fillOpacity: 0.15 }}
          />
        </>
      )}

      {/* Cerchio in disegno */}
      {drawingMode && (
        <Circle
          center={drawingMode.center}
          radius={drawingMode.radius}
          pathOptions={{ color: "red", fillColor: "red", fillOpacity: 0.2, dashArray: "10,5" }}
        />
      )}
    </MapContainer>
  );
}
