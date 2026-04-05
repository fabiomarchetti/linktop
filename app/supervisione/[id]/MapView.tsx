"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

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
  onMapClick?: (lat: number, lng: number) => void;
}

// Componente che centra la mappa quando cambia la posizione
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Componente che cattura i click sulla mappa
function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onClick) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  center,
  currentPosition,
  history,
  geofences,
  drawingMode,
  onMapClick,
}: MapViewProps) {
  const historyLine: [number, number][] = history.map((p) => [p.lat, p.lng]);

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
      <ClickHandler onClick={onMapClick} />

      {/* Storico movimenti (polyline) */}
      {historyLine.length > 1 && (
        <Polyline positions={historyLine} color="blue" weight={3} opacity={0.6} dashArray="5,8" />
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
