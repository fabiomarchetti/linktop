'use client'

import { useState } from 'react'
import { Bluetooth, Check, X, Loader, AlertTriangle } from 'lucide-react'

interface BluetoothScannerProps {
  deviceType: 'stetoscopio' | 'otoscopio' | 'health_monitor'
  onDeviceRegistered: (dispositivo: any) => void
  onClose: () => void
}

export default function BluetoothScanner({ deviceType, onDeviceRegistered, onClose }: BluetoothScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discoveredDevice, setDiscoveredDevice] = useState<any>(null)

  const getDeviceLabel = (type: string) => {
    switch (type) {
      case 'stetoscopio':
        return 'Stetoscopio'
      case 'otoscopio':
        return 'Otoscopio'
      case 'health_monitor':
        return 'Health Monitor'
      default:
        return type
    }
  }

  const scanForDevice = async () => {
    setScanning(true)
    setError(null)
    setDiscoveredDevice(null)

    try {
      // Verifica supporto Web Bluetooth
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth non è supportato in questo browser. Usa Chrome, Edge o Opera.')
      }

      // Configurazione filtri per tipo di dispositivo
      const filters = getBluetoothFilters(deviceType)

      // Richiedi dispositivo Bluetooth
      const device = await navigator.bluetooth.requestDevice({
        filters: filters,
        optionalServices: ['battery_service'] // Servizio batteria opzionale
      })

      if (!device) {
        throw new Error('Nessun dispositivo selezionato')
      }

      // Estrai MAC Address (se disponibile) o usa l'ID del dispositivo
      // Nota: Il Web Bluetooth API non espone sempre il MAC Address per privacy
      // Usiamo device.id come identificatore univoco
      const deviceId = device.id || device.name || generateRandomId()

      setDiscoveredDevice({
        name: device.name || 'Dispositivo Sconosciuto',
        id: deviceId,
        type: deviceType
      })

      // Registra automaticamente il dispositivo
      await registerDevice(deviceId, device.name)

    } catch (err: any) {
      console.error('Errore scan Bluetooth:', err)

      if (err.name === 'NotFoundError') {
        setError('Nessun dispositivo trovato. Assicurati che sia acceso e nelle vicinanze.')
      } else if (err.name === 'SecurityError') {
        setError('Accesso Bluetooth negato. Abilita i permessi del browser.')
      } else {
        setError(err.message || 'Errore durante la scansione del dispositivo')
      }
    } finally {
      setScanning(false)
    }
  }

  const registerDevice = async (deviceIdentifier: string, deviceName: string | undefined) => {
    setRegistering(true)

    try {
      const response = await fetch('/api/dispositivi/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_identifier: deviceIdentifier,
          device_name: deviceName,
          device_type: deviceType
        })
      })

      const data = await response.json()

      if (data.success) {
        // Notifica il parent component
        onDeviceRegistered(data.dispositivo)
      } else {
        setError(data.error || 'Errore nella registrazione del dispositivo')
      }
    } catch (err: any) {
      console.error('Errore registrazione dispositivo:', err)
      setError('Errore di connessione durante la registrazione')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
          <Bluetooth className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Scansione {getDeviceLabel(deviceType)}
        </h3>
        <p className="text-gray-400 text-sm">
          Accendi il dispositivo e mantienilo vicino al computer
        </p>
      </div>

      {/* Errori */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Dispositivo scoperto */}
      {discoveredDevice && !error && (
        <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <div className="flex-1">
              <p className="text-white font-semibold">{discoveredDevice.name}</p>
              <p className="text-gray-400 text-sm">ID: {discoveredDevice.id.substring(0, 20)}...</p>
            </div>
          </div>
        </div>
      )}

      {/* Pulsanti azione */}
      <div className="flex gap-3">
        {!discoveredDevice && (
          <button
            onClick={scanForDevice}
            disabled={scanning}
            className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {scanning ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Scansione in corso...
              </>
            ) : (
              <>
                <Bluetooth className="w-5 h-5" />
                Avvia Scansione
              </>
            )}
          </button>
        )}

        {discoveredDevice && registering && (
          <div className="flex-1 px-4 py-3 bg-emerald-500/20 text-emerald-300 rounded-lg font-semibold flex items-center justify-center gap-2">
            <Loader className="w-5 h-5 animate-spin" />
            Registrazione in corso...
          </div>
        )}

        <button
          onClick={onClose}
          disabled={scanning || registering}
          className="px-4 py-3 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg font-semibold transition-all disabled:opacity-50"
        >
          {discoveredDevice && !error ? 'Chiudi' : 'Annulla'}
        </button>
      </div>

      {/* Info aggiuntive */}
      <div className="pt-4 border-t border-white/10">
        <p className="text-xs text-gray-500 text-center">
          💡 Se non vedi il dispositivo, assicurati che sia acceso e in modalità pairing
        </p>
      </div>
    </div>
  )
}

/**
 * Restituisce i filtri Bluetooth appropriati per tipo di dispositivo
 */
function getBluetoothFilters(deviceType: string): BluetoothLEScanFilter[] {
  // Filtri basati sui nomi comuni dei dispositivi LINKTOP
  const nameFilters: { [key: string]: string[] } = {
    'stetoscopio': ['stethoscope', 'stetoscopio', 'linktop', 'steth'],
    'otoscopio': ['otoscope', 'otoscopio', 'linktop', 'oto'],
    'health_monitor': ['health', 'monitor', 'linktop', 'hm', '6-in-1']
  }

  const names = nameFilters[deviceType] || []

  // Crea filtri per ogni variante del nome
  const filters: BluetoothLEScanFilter[] = names.map(name => ({
    namePrefix: name
  }))

  // Se non ci sono filtri specifici, accetta tutti i dispositivi
  if (filters.length === 0) {
    return [{ acceptAllDevices: true } as any]
  }

  return filters
}

/**
 * Genera un ID casuale se non disponibile
 */
function generateRandomId(): string {
  return 'BLE-' + Math.random().toString(36).substring(2, 15)
}
