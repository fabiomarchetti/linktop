'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Users, Smartphone, Activity, Stethoscope, Eye, Heart,
  Check, X, AlertTriangle, RefreshCw, Search, Plus, Trash2, Info, Bluetooth
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'

interface Paziente {
  id: number
  nome: string
  cognome: string
  codice_fiscale: string | null
  telefono: string | null
}

interface Dispositivo {
  id: number
  device_name: string
  device_type: 'stetoscopio' | 'otoscopio' | 'health_monitor'
  device_identifier: string
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  firmware_version: string | null
  battery_level: number | null
  connection_status: string
  paziente_id: number | null
  paziente_nome: string | null
  paziente_cognome: string | null
  paziente_telefono: string | null
  assigned_date: string | null
}

interface AssegnazioniPaziente {
  paziente: Paziente
  stetoscopio: Dispositivo | null
  otoscopio: Dispositivo | null
  health_monitor: Dispositivo | null
}

export default function PazientiDispositiviPage() {
  const [pazienti, setPazienti] = useState<Paziente[]>([])
  const [dispositivi, setDispositivi] = useState<Dispositivo[]>([])
  const [assegnazioni, setAssegnazioni] = useState<AssegnazioniPaziente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedPaziente, setSelectedPaziente] = useState<Paziente | null>(null)
  const [selectedDeviceType, setSelectedDeviceType] = useState<'stetoscopio' | 'otoscopio' | 'health_monitor' | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showManualRegister, setShowManualRegister] = useState(false)
  const [manualSerialNumber, setManualSerialNumber] = useState('')
  const [manualDeviceName, setManualDeviceName] = useState('')
  const [registering, setRegistering] = useState(false)
  const [detectingUSB, setDetectingUSB] = useState(false)
  const [detectedUSBDevices, setDetectedUSBDevices] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch pazienti
      const pazientiRes = await fetch('/api/pazienti')
      const pazientiData = await pazientiRes.json()

      // Fetch dispositivi
      const dispositiviRes = await fetch('/api/dispositivi')
      const dispositiviData = await dispositiviRes.json()

      if (pazientiData.success && dispositiviData.success) {
        setPazienti(pazientiData.pazienti)
        setDispositivi(dispositiviData.dispositivi)

        // Costruisci assegnazioni
        const assegnazioniMap = pazientiData.pazienti.map((p: Paziente) => ({
          paziente: p,
          stetoscopio: dispositiviData.dispositivi.find(
            (d: Dispositivo) => d.paziente_id === p.id && d.device_type === 'stetoscopio'
          ) || null,
          otoscopio: dispositiviData.dispositivi.find(
            (d: Dispositivo) => d.paziente_id === p.id && d.device_type === 'otoscopio'
          ) || null,
          health_monitor: dispositiviData.dispositivi.find(
            (d: Dispositivo) => d.paziente_id === p.id && d.device_type === 'health_monitor'
          ) || null
        }))

        setAssegnazioni(assegnazioniMap)
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error)
      setMessage({ type: 'error', text: 'Errore nel caricamento dei dati' })
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (dispositivoId: number) => {
    if (!selectedPaziente) return

    setAssigning(true)
    try {
      const response = await fetch(`/api/dispositivi/${dispositivoId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paziente_id: selectedPaziente.id })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setShowAssignModal(false)
        setSelectedPaziente(null)
        setSelectedDeviceType(null)
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore nell\'assegnazione' })
    } finally {
      setAssigning(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleUnassign = async (dispositivoId: number) => {
    if (!confirm('Sei sicuro di voler rimuovere questa assegnazione?')) return

    try {
      const response = await fetch(`/api/dispositivi/${dispositivoId}/assign`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore nella rimozione' })
    }

    setTimeout(() => setMessage(null), 3000)
  }

  const handleDeleteDevice = async (dispositivoId: number, deviceName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il dispositivo "${deviceName}"?`)) return

    try {
      const response = await fetch(`/api/dispositivi/${dispositivoId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })

        // Aggiorna lo stato locale rimuovendo il dispositivo eliminato
        setDispositivi(prevDispositivi =>
          prevDispositivi.filter(d => d.id !== dispositivoId)
        )
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione del dispositivo' })
    }

    setTimeout(() => setMessage(null), 3000)
  }

  const openAssignModal = (paziente: Paziente, deviceType: 'stetoscopio' | 'otoscopio' | 'health_monitor') => {
    setSelectedPaziente(paziente)
    setSelectedDeviceType(deviceType)
    setScanError(null)
    setShowAssignModal(true)
  }

  const detectUSBCamera = async () => {
    setDetectingUSB(true)
    setScanError(null)
    setDetectedUSBDevices([])

    try {
      // Prima richiedi permessi per accedere alla webcam
      // Questo è necessario per ottenere i label dei dispositivi
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })

      // Enumera tutti i dispositivi media
      const devices = await navigator.mediaDevices.enumerateDevices()

      // Ferma lo stream ora che abbiamo i permessi
      stream.getTracks().forEach(track => track.stop())

      // Filtra solo dispositivi video (webcam/otoscopi)
      const videoDevices = devices.filter(device => device.kind === 'videoinput')

      if (videoDevices.length === 0) {
        setScanError('Nessuna webcam/otoscopio USB rilevato. Controlla che sia collegato.')
        return
      }

      // Mappa i dispositivi in un formato più leggibile
      const mappedDevices = videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || 'Dispositivo Sconosciuto',
        groupId: device.groupId
      }))

      console.log('Dispositivi USB rilevati:', mappedDevices)
      setDetectedUSBDevices(mappedDevices)

      // Se c'è solo un dispositivo, precompila i campi
      if (mappedDevices.length === 1) {
        const device = mappedDevices[0]
        setManualSerialNumber(device.deviceId.substring(0, 12).toUpperCase())
        setManualDeviceName(device.label)
      }

    } catch (err: any) {
      console.error('Errore rilevamento USB:', err)

      if (err.name === 'NotAllowedError') {
        setScanError('Permesso webcam negato. Abilita l\'accesso alla webcam nelle impostazioni del browser.')
      } else if (err.name === 'NotFoundError') {
        setScanError('Nessuna webcam trovata. Assicurati che l\'otoscopio USB sia collegato.')
      } else {
        setScanError('Errore nel rilevamento USB: ' + err.message)
      }
    } finally {
      setDetectingUSB(false)
    }
  }

  const selectUSBDevice = (device: any) => {
    // Usa il deviceId come identificatore univoco
    setManualSerialNumber(device.deviceId.substring(0, 12).toUpperCase())
    setManualDeviceName(device.label)
    setDetectedUSBDevices([])
  }

  const handleManualRegister = async () => {
    if (!selectedDeviceType || !manualSerialNumber) {
      setScanError('Inserisci il numero seriale del dispositivo')
      return
    }

    setRegistering(true)
    setScanError(null)

    try {
      const deviceName = manualDeviceName || `Otoscopio USB ${manualSerialNumber}`

      const response = await fetch('/api/dispositivi/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_identifier: `USB-${manualSerialNumber}`,
          device_name: deviceName,
          device_type: selectedDeviceType
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Otoscopio "${deviceName}" registrato con successo!`
        })

        // Reset form
        setManualSerialNumber('')
        setManualDeviceName('')
        setShowManualRegister(false)
        setDetectedUSBDevices([])

        // Ricarica i dati
        await fetchData()

        // Chiudi e riapri modal
        setTimeout(() => {
          if (selectedPaziente && selectedDeviceType) {
            openAssignModal(selectedPaziente, selectedDeviceType)
          }
        }, 500)
      } else {
        setScanError(data.error || 'Errore nella registrazione')
      }
    } catch (err: any) {
      console.error('Errore registrazione manuale:', err)
      setScanError('Errore di connessione')
    } finally {
      setRegistering(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleScanNewDevice = async () => {
    if (!selectedDeviceType) return

    // L'otoscopio è USB, non Bluetooth!
    if (selectedDeviceType === 'otoscopio') {
      setShowManualRegister(true)
      return
    }

    setScanning(true)
    setScanError(null)

    try {
      // Verifica supporto Web Bluetooth
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth non supportato. Usa Chrome, Edge o Opera.')
      }

      // Configurazione filtri basati sul tipo di dispositivo
      const filters = getBluetoothFilters(selectedDeviceType)
      const services = getBluetoothServices(selectedDeviceType)

      // Richiedi dispositivo Bluetooth
      const bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: filters,
        optionalServices: services
      })

      if (!bluetoothDevice) {
        throw new Error('Nessun dispositivo selezionato')
      }

      // Estrai identificativo (device.id è univoco per ogni dispositivo)
      const deviceIdentifier = bluetoothDevice.id || bluetoothDevice.name || generateDeviceId()
      const deviceName = bluetoothDevice.name || 'Dispositivo Sconosciuto'

      // Registra automaticamente il dispositivo tramite API
      const response = await fetch('/api/dispositivi/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_identifier: deviceIdentifier,
          device_name: deviceName,
          device_type: selectedDeviceType
        })
      })

      const data = await response.json()

      if (data.success) {
        // Se già esisteva, mostra messaggio
        if (data.already_exists) {
          setMessage({
            type: 'success',
            text: `Dispositivo "${deviceName}" già registrato`
          })
        } else {
          setMessage({
            type: 'success',
            text: `Dispositivo "${deviceName}" registrato con successo!`
          })
        }

        // Ricarica i dati per mostrare il nuovo dispositivo
        await fetchData()

        // Chiudi modal e riapri per mostrare il nuovo dispositivo disponibile
        setTimeout(() => {
          if (selectedPaziente && selectedDeviceType) {
            openAssignModal(selectedPaziente, selectedDeviceType)
          }
        }, 500)
      } else {
        setScanError(data.error || 'Errore nella registrazione del dispositivo')
      }
    } catch (err: any) {
      console.error('Errore scan Bluetooth:', err)

      if (err.name === 'NotFoundError') {
        setScanError('Nessun dispositivo trovato. Assicurati che sia acceso e nelle vicinanze.')
      } else if (err.name === 'SecurityError') {
        setScanError('Accesso Bluetooth negato. Abilita i permessi del browser.')
      } else {
        setScanError(err.message || 'Errore durante la scansione')
      }
    } finally {
      setScanning(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'stetoscopio':
        return <Stethoscope className="w-5 h-5" />
      case 'otoscopio':
        return <Eye className="w-5 h-5" />
      case 'health_monitor':
        return <Heart className="w-5 h-5" />
      default:
        return <Smartphone className="w-5 h-5" />
    }
  }

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

  const getDeviceName = (type: 'stetoscopio' | 'otoscopio' | 'health_monitor') => {
    switch (type) {
      case 'stetoscopio':
        return 'Stetoscopio'
      case 'otoscopio':
        return 'Otoscopio'
      case 'health_monitor':
        return 'Health Monitor'
    }
  }

  const disponibiliPerTipo = (tipo: 'stetoscopio' | 'otoscopio' | 'health_monitor') => {
    return dispositivi.filter(d => d.device_type === tipo && !d.paziente_id)
  }

  const filteredAssegnazioni = assegnazioni.filter(a =>
    a.paziente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.paziente.cognome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.paziente.codice_fiscale && a.paziente.codice_fiscale.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Helper functions per Bluetooth
  function getBluetoothFilters(deviceType: string): BluetoothLEScanFilter[] {
    switch (deviceType) {
      case 'stetoscopio':
        return [{ namePrefix: 'HC-' }]  // Stetoscopio LINKTOP: HC-21, HC-22, etc
      case 'health_monitor':
        return [{ namePrefix: 'HM-' }, { namePrefix: 'M7-' }]  // Health Monitor: HM-xxx o M7-xxx
      default:
        return [{ acceptAllDevices: true } as any]
    }
  }

  function getBluetoothServices(deviceType: string): string[] {
    const commonServices = [
      '0000180a-0000-1000-8000-00805f9b34fb',  // Device Information
      '0000180f-0000-1000-8000-00805f9b34fb',  // Battery Service
    ]

    switch (deviceType) {
      case 'stetoscopio':
        return [
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e',  // NORDIC UART Audio Service
          ...commonServices
        ]
      case 'health_monitor':
        return commonServices
      default:
        return commonServices
    }
  }

  function generateDeviceId(): string {
    return 'BLE-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <Sidebar />

      <main className="ml-64 transition-all duration-300">
        <header className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-lg transition-all">
                <ArrowLeft className="w-6 h-6 text-white" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Smartphone className="w-8 h-8" />
                  Assegnazione Dispositivi
                </h1>
                <p className="text-gray-300 mt-1">
                  {dispositivi.filter(d => !d.paziente_id).length} dispositivi disponibili
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca pazienti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={fetchData}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        <div className="relative z-10 p-8">
          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}>
              {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {message.text}
            </div>
          )}

          {/* Assegnazioni List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
              <p className="text-white text-lg">Caricamento...</p>
            </div>
          ) : filteredAssegnazioni.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="w-16 h-16 text-gray-500 mb-4" />
              <p className="text-white text-lg">Nessun paziente trovato</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssegnazioni.map((assegnazione) => (
                <div
                  key={assegnazione.paziente.id}
                  className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                >
                  {/* Paziente Header */}
                  <div className="p-6 bg-white/5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {assegnazione.paziente.nome.charAt(0)}{assegnazione.paziente.cognome.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg">
                            {assegnazione.paziente.nome} {assegnazione.paziente.cognome}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-300">
                            {assegnazione.paziente.codice_fiscale && (
                              <span>{assegnazione.paziente.codice_fiscale}</span>
                            )}
                            {assegnazione.paziente.telefono && (
                              <span>• {assegnazione.paziente.telefono}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Dispositivi */}
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${assegnazione.stetoscopio ? 'bg-green-500' : 'bg-gray-500'}`} title={assegnazione.stetoscopio ? 'Stetoscopio assegnato' : 'Stetoscopio non assegnato'} />
                        <div className={`w-3 h-3 rounded-full ${assegnazione.otoscopio ? 'bg-green-500' : 'bg-gray-500'}`} title={assegnazione.otoscopio ? 'Otoscopio assegnato' : 'Otoscopio non assegnato'} />
                        <div className={`w-3 h-3 rounded-full ${assegnazione.health_monitor ? 'bg-green-500' : 'bg-gray-500'}`} title={assegnazione.health_monitor ? 'Health Monitor assegnato' : 'Health Monitor non assegnato'} />
                      </div>
                    </div>
                  </div>

                  {/* Dispositivi Grid */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stetoscopio */}
                    <DeviceCard
                      type="stetoscopio"
                      device={assegnazione.stetoscopio}
                      onAssign={() => openAssignModal(assegnazione.paziente, 'stetoscopio')}
                      onUnassign={() => assegnazione.stetoscopio && handleUnassign(assegnazione.stetoscopio.id)}
                    />

                    {/* Otoscopio */}
                    <DeviceCard
                      type="otoscopio"
                      device={assegnazione.otoscopio}
                      onAssign={() => openAssignModal(assegnazione.paziente, 'otoscopio')}
                      onUnassign={() => assegnazione.otoscopio && handleUnassign(assegnazione.otoscopio.id)}
                    />

                    {/* Health Monitor */}
                    <DeviceCard
                      type="health_monitor"
                      device={assegnazione.health_monitor}
                      onAssign={() => openAssignModal(assegnazione.paziente, 'health_monitor')}
                      onUnassign={() => assegnazione.health_monitor && handleUnassign(assegnazione.health_monitor.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assign Modal */}
        {showAssignModal && selectedPaziente && selectedDeviceType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/20 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-slate-900 border-b border-emerald-500/20 p-6 z-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Plus className="w-6 h-6 text-emerald-400" />
                  Assegna {getDeviceName(selectedDeviceType)}
                </h2>
                <p className="text-gray-400 mt-1">
                  Paziente: {selectedPaziente.nome} {selectedPaziente.cognome}
                </p>
              </div>

              <div className="p-6">
                {/* Form Registrazione Manuale (per Otoscopio USB) */}
                {showManualRegister ? (
                  <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-semibold">Registrazione Otoscopio USB</h3>
                      <button
                        onClick={() => {
                          setShowManualRegister(false)
                          setManualSerialNumber('')
                          setManualDeviceName('')
                          setDetectedUSBDevices([])
                          setScanError(null)
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Pulsante Rilevamento Automatico */}
                    <button
                      onClick={detectUSBCamera}
                      disabled={detectingUSB}
                      className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {detectingUSB ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Rilevamento in corso...
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5" />
                          Rileva Automaticamente
                        </>
                      )}
                    </button>

                    {/* Lista dispositivi rilevati */}
                    {detectedUSBDevices.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-gray-400 text-sm">Seleziona un dispositivo:</p>
                        {detectedUSBDevices.map((device, index) => (
                          <button
                            key={index}
                            onClick={() => selectUSBDevice(device)}
                            className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-lg text-left transition-all"
                          >
                            <p className="text-white font-semibold">{device.label}</p>
                            <p className="text-gray-400 text-xs">ID: {device.deviceId.substring(0, 20)}...</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Separatore */}
                    {detectedUSBDevices.length > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-white/10"></div>
                        <span className="text-gray-400 text-xs">oppure inserisci manualmente</span>
                        <div className="flex-1 h-px bg-white/10"></div>
                      </div>
                    )}

                    <div>
                      <label className="block text-gray-400 text-sm mb-2">
                        Numero Seriale * {detectedUSBDevices.length === 0 && '(stampato sul dispositivo)'}
                      </label>
                      <input
                        type="text"
                        value={manualSerialNumber}
                        onChange={(e) => setManualSerialNumber(e.target.value.toUpperCase())}
                        placeholder="es: OTO-001"
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm mb-2">
                        Nome Dispositivo (opzionale)
                      </label>
                      <input
                        type="text"
                        value={manualDeviceName}
                        onChange={(e) => setManualDeviceName(e.target.value)}
                        placeholder="es: Otoscopio Ambulatorio A"
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={handleManualRegister}
                      disabled={registering || !manualSerialNumber}
                      className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {registering ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Registrazione...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Registra Otoscopio
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* Pulsante Scan Nuovo Dispositivo */
                  <button
                    onClick={handleScanNewDevice}
                    disabled={scanning}
                    className="w-full mb-4 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {scanning ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Scansione in corso...
                      </>
                    ) : (
                      <>
                        <Bluetooth className="w-5 h-5" />
                        {selectedDeviceType === 'otoscopio' ? 'Registra Otoscopio USB' : 'Scan Nuovo Dispositivo'}
                      </>
                    )}
                  </button>
                )}

                {/* Errore Scan */}
                {scanError && !showManualRegister && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{scanError}</p>
                  </div>
                )}

                {/* Separatore */}
                {disponibiliPerTipo(selectedDeviceType).length > 0 && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-gray-400 text-sm">oppure seleziona uno già registrato</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>
                )}

                <div className="space-y-3">
                  {disponibiliPerTipo(selectedDeviceType).length === 0 ? (
                    <div className="p-8 text-center">
                      <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                      <p className="text-white text-lg">Nessun dispositivo già registrato</p>
                      <p className="text-gray-400 mt-2">Usa il pulsante "Scan" sopra per scoprire nuovi dispositivi</p>
                    </div>
                  ) : (
                    disponibiliPerTipo(selectedDeviceType).map((dispositivo) => (
                      <div
                        key={dispositivo.id}
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400">
                              {getDeviceIcon(dispositivo.device_type)}
                            </div>
                            <div className="flex-1">
                              <p className="text-white font-semibold">{dispositivo.device_name}</p>
                              <p className="text-gray-400 text-sm">ID: {dispositivo.device_identifier}</p>
                              {dispositivo.serial_number && (
                                <p className="text-gray-500 text-xs">S/N: {dispositivo.serial_number}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAssign(dispositivo.id)}
                            disabled={assigning}
                            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            Assegna
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteDevice(dispositivo.id, dispositivo.device_name)
                            }}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                            Elimina
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-slate-900 border-t border-emerald-500/20 p-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedPaziente(null)
                    setSelectedDeviceType(null)
                  }}
                  className="px-6 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-all"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Device Card Component
function DeviceCard({
  type,
  device,
  onAssign,
  onUnassign
}: {
  type: 'stetoscopio' | 'otoscopio' | 'health_monitor'
  device: Dispositivo | null
  onAssign: () => void
  onUnassign: () => void
}) {
  const getIcon = () => {
    switch (type) {
      case 'stetoscopio':
        return <Stethoscope className="w-6 h-6" />
      case 'otoscopio':
        return <Eye className="w-6 h-6" />
      case 'health_monitor':
        return <Heart className="w-6 h-6" />
    }
  }

  const getLabel = () => {
    switch (type) {
      case 'stetoscopio':
        return 'Stetoscopio'
      case 'otoscopio':
        return 'Otoscopio'
      case 'health_monitor':
        return 'Health Monitor'
    }
  }

  const getColor = () => {
    switch (type) {
      case 'stetoscopio':
        return 'blue'
      case 'otoscopio':
        return 'purple'
      case 'health_monitor':
        return 'red'
    }
  }

  const color = getColor()

  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${device ? 'border-green-500/30' : 'border-gray-500/30'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 bg-${color}-500/20 rounded-lg text-${color}-400`}>
          {getIcon()}
        </div>
        <span className="text-sm text-gray-400">{getLabel()}</span>
      </div>

      {device ? (
        <div>
          <p className="text-white font-semibold text-sm mb-1">{device.device_name}</p>
          <p className="text-gray-400 text-xs mb-1">MAC: {device.device_identifier}</p>
          {device.serial_number && (
            <p className="text-gray-500 text-xs mb-3">S/N: {device.serial_number}</p>
          )}
          <button
            onClick={onUnassign}
            className="w-full px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Trash2 className="w-3 h-3" />
            Rimuovi
          </button>
        </div>
      ) : (
        <button
          onClick={onAssign}
          className="w-full px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          Assegna
        </button>
      )}
    </div>
  )
}
