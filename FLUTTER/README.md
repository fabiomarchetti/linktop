# 📍 Sistema di Monitoraggio Anziani con Geofencing

Sistema completo per il monitoraggio di anziani che vivono soli, con:
- **GPS tracking** con geofencing intelligente
- **Anello Colmi R06** per HR e SpO2 (trigger remoto!)
- **Dashboard familiare** su monitoraggiosalute.com
- **Alert automatici** per eventi critici

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD FAMILIARE                       │
│              (monitoraggiosalute.com / Next.js)              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │  Mappa  │  │ Salute  │  │ Alerts  │  │ "Misura Ora" ▶  │ │
│  │   GPS   │  │ HR/SpO2 │  │  🔔     │  │   Trigger       │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Supabase Realtime
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ gps_positions│  │  geofences   │  │   alerts     │       │
│  │ geofence_evts│  │remote_command│  │health_measure│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS + Realtime
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SMARTPHONE ANZIANO (App Flutter)                │
│                    Foreground Service                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MonitoringService                                   │   │
│  │  ├── GPS Tracking (ogni 5 min)                       │   │
│  │  ├── GeofenceService (check entrata/uscita zone)     │   │
│  │  ├── ColmiRingService (BLE)                          │   │
│  │  ├── Comandi Remoti Listener                         │   │
│  │  └── Alert "Fuori casa troppo tempo"                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ BLE
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    COLMI R06 RING                            │
│  💍 Sul dito dell'anziano                                    │
│  ├── HR automatico ogni 20-30 min                           │
│  ├── SpO2 on-demand                                         │
│  ├── Passi, sonno, stress                                   │
│  └── 7 giorni autonomia                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 Sistema Geofencing

### Tipi di Zone

| Tipo | Icona | Descrizione | Alert |
|------|-------|-------------|-------|
| `home` | 🏠 | Casa dell'anziano | Entrata/Uscita |
| `safe` | ✅ | Zone sicure (bar, chiesa, farmacia) | Opzionale |
| `medical` | 🏥 | Strutture mediche | Entrata = Warning |
| `family` | 👨‍👩‍👧 | Casa di familiari | Opzionale |
| `custom` | 📍 | Zone personalizzate | Configurabile |

### Eventi Geofence

```
USCITA DA CASA
─────────────────────────────────────────
🏠 ──────────┐
             │  🚶 Anziano esce
             └──────────────────────────▶
                      │
                      ▼
              INSERT geofence_events
              (event_type: 'exit')
                      │
                      ▼
              INSERT alerts
              (type: 'left_home', severity: 'info')
                      │
                      ▼
              📱 Notifica al familiare:
              "Mario ha lasciato casa alle 10:30"
```

### Controllo "Fuori Casa Troppo Tempo"

```dart
// Ogni 15 minuti controlla
if (timeOutside > 3 ore) {
  // ALERT CRITICO
  "⚠️ Mario è fuori casa da 3 ore!"
}
```

---

## 📁 Struttura Progetto

```
elderly_monitoring_app/
├── lib/
│   ├── main.dart
│   ├── models/
│   │   └── geofence.dart              # Modello Geofence
│   ├── services/
│   │   ├── colmi_ring_service.dart    # BLE Colmi Ring
│   │   ├── geofence_service.dart      # Logica Geofencing
│   │   └── monitoring_service.dart    # Foreground Service
│   ├── screens/
│   │   ├── home_screen.dart           # UI principale anziano
│   │   └── setup_screen.dart          # Configurazione iniziale
│   └── widgets/
│       ├── sos_button.dart            # Bottone SOS grande
│       └── status_card.dart           # Card stato connessione
├── database/
│   └── schema.sql                     # Schema Supabase completo
├── android/
│   └── app/src/main/AndroidManifest.xml
├── ios/
│   └── Runner/Info.plist
└── pubspec.yaml
```

---

## 🗃️ Tabelle Database

### `geofences`
Zone geografiche configurate per ogni paziente.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | UUID | Identificativo |
| `patient_id` | UUID | Paziente |
| `name` | VARCHAR | Nome zona ("Casa", "Bar Mario") |
| `lat` | DECIMAL | Latitudine centro |
| `lng` | DECIMAL | Longitudine centro |
| `radius_meters` | INTEGER | Raggio in metri (default 50) |
| `type` | VARCHAR | home/safe/medical/family/custom |
| `notify_on_enter` | BOOLEAN | Notifica su entrata |
| `notify_on_exit` | BOOLEAN | Notifica su uscita |

### `geofence_events`
Storico entrate/uscite dalle zone.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | UUID | Identificativo |
| `patient_id` | UUID | Paziente |
| `geofence_id` | UUID | Zona |
| `event_type` | VARCHAR | enter/exit/dwell |
| `lat` | DECIMAL | Posizione evento |
| `lng` | DECIMAL | Posizione evento |
| `accuracy` | DECIMAL | Precisione GPS (metri) |
| `created_at` | TIMESTAMP | Quando |

### `alerts`
Notifiche/alert per i familiari.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | UUID | Identificativo |
| `patient_id` | UUID | Paziente |
| `type` | VARCHAR | left_home, low_spo2, etc. |
| `message` | TEXT | Messaggio leggibile |
| `severity` | VARCHAR | info/warning/critical |
| `is_read` | BOOLEAN | Letto dal familiare |

---

## ⚙️ Configurazione

### 1. Supabase

```bash
# Crea progetto su supabase.com
# Esegui schema.sql nel SQL Editor
# Copia URL e anon key
```

### 2. Flutter App

```dart
// lib/main.dart
await Supabase.initialize(
  url: 'https://xxx.supabase.co',
  anonKey: 'xxx',
);
```

### 3. Permessi Android

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

### 4. Permessi iOS

```xml
<!-- ios/Runner/Info.plist -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Per monitorare la tua posizione</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>Per monitorare la posizione anche in background</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Per connettersi all'anello Colmi</string>
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>location</string>
</array>
```

---

## 🚀 Uso

### Avvio Monitoraggio

```dart
// Avvia foreground service
await FlutterForegroundTask.startService(
  notificationTitle: '📍 Monitoraggio attivo',
  notificationText: 'GPS e anello connessi',
  callback: startCallback,
);
```

### Aggiungere Geofence (da dashboard)

```typescript
// Next.js - Dashboard familiare
await supabase.from('geofences').insert({
  patient_id: patientId,
  name: 'Bar del paese',
  lat: 43.6162,
  lng: 13.5195,
  radius_meters: 30,
  type: 'safe',
  notify_on_enter: true,
  notify_on_exit: false,
});
```

### Trigger Misura Remota

```typescript
// Next.js - Bottone "Misura SpO2 Ora"
await supabase.from('remote_commands').insert({
  patient_id: patientId,
  command: 'measure_spo2',
  status: 'pending',
});

// L'app Flutter riceve via Realtime, esegue, e aggiorna:
// status: 'completed', result: { spo2: 97, hr: 72 }
```

---

## 📊 Flusso Dati Tipico

```
08:30 - 🏠 Anziano a casa
        └─ GPS: position saved
        └─ Geofence: inside "Casa"
        
09:00 - 🚶 Anziano esce
        └─ GPS: position saved  
        └─ Geofence: EXIT "Casa"
        └─ Alert: "Ha lasciato casa"
        └─ 📱 Push notification al familiare
        
09:15 - ☕ Anziano arriva al bar
        └─ GPS: position saved
        └─ Geofence: ENTER "Bar Mario"
        └─ (no alert, zona sicura)
        
10:00 - 📱 Familiare chiede SpO2
        └─ remote_command: measure_spo2
        └─ Ring misura: SpO2 97%, HR 72
        └─ health_measurements: saved
        └─ Dashboard aggiornata
        
10:30 - 🏠 Anziano torna a casa
        └─ GPS: position saved
        └─ Geofence: EXIT "Bar Mario"
        └─ Geofence: ENTER "Casa"
        └─ Alert: "È tornato a casa"
```

---

## 💰 Costi Sistema

| Componente | Prezzo |
|------------|--------|
| Colmi R06 | €25 |
| Smartphone Android | €80-100 |
| SIM Iliad | €60/anno |
| Supabase | Free tier |
| **Totale anno 1** | **~€165** |
| **Anni successivi** | **€60/anno** |

---

## 📝 TODO

- [ ] Acquistare Colmi R06 su AliExpress
- [ ] Creare tabelle Supabase (eseguire schema.sql)
- [ ] Sviluppare UI Flutter (home screen, setup)
- [ ] Integrare dashboard Next.js su monitoraggiosalute.com
- [ ] Test connessione BLE su dispositivo reale
- [ ] Configurare push notifications (Firebase)

---

## 📚 Riferimenti

- [Colmi R02 Client (Python)](https://github.com/tahnok/colmi_r02_client)
- [Gadgetbridge Colmi Support](https://gadgetbridge.org/gadgets/wearables/yawell/)
- [Flutter Blue Plus](https://pub.dev/packages/flutter_blue_plus)
- [Supabase Flutter](https://pub.dev/packages/supabase_flutter)
- [Geolocator](https://pub.dev/packages/geolocator)
