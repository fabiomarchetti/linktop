'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Stethoscope, Play, Square, Save, Download,
  RefreshCw, AlertTriangle, CheckCircle
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'

// Interfaccia per i dati del dispositivo
interface DeviceData {
  deviceId: string
  deviceName: string
  isConnected: boolean
  batteryLevel: number
}

export default function StetoscopioPage() {
  const [status, setStatus] = useState<string>('Pronto per la connessione')
  const [device, setDevice] = useState<DeviceData>({
    deviceId: 'Non connesso',
    deviceName: '',
    isConnected: false,
    batteryLevel: 0
  })

  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null)
  const [gattServer, setGattServer] = useState<BluetoothRemoteGATTServer | null>(null)
  const [writeCharacteristic, setWriteCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null)
  const [notifyCharacteristic, setNotifyCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [recordingMode, setRecordingMode] = useState<'heart' | 'lung'>('heart')
  const [patientCode, setPatientCode] = useState<string>('')

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioBufferRef = useRef<Int16Array[]>([])  // Buffer per samples audio
  const isRecordingRef = useRef<boolean>(false)  // Ref per evitare closure problems

  // Verifica supporto Web Bluetooth
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.bluetooth) {
      setStatus('❌ Web Bluetooth non supportato in questo browser. Usa Chrome o Edge.')
      setErrorMessage('Browser non supportato')
    }
  }, [])

  // Handler per dati audio ricevuti dal dispositivo
  const handleAudioData = (event: any) => {
    const value = event.target.value as DataView

    // Crea Int16Array gestendo correttamente byteOffset e byteLength
    const samples = new Int16Array(value.buffer, value.byteOffset, value.byteLength / 2)

    // Accumula samples nel buffer SOLO SE stiamo registrando
    // USA REF invece dello stato per evitare problemi di closure!
    if (isRecordingRef.current) {
      audioBufferRef.current.push(samples)
      console.log(`🎵 Ricevuti ${samples.length} samples audio (totale: ${audioBufferRef.current.length} chunks)`)
    }
    // Se non stiamo registrando, ignora silenziosamente (dispositivo invia sempre dati)
  }

  // Funzione per creare header WAV
  const createWavHeader = (audioLength: number): Uint8Array => {
    const sampleRate = 4000  // 4 kHz
    const numChannels = 1    // Mono
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)
    const dataSize = audioLength * 2  // 2 bytes per sample

    const header = new ArrayBuffer(44)
    const view = new DataView(header)

    // "RIFF" chunk descriptor
    view.setUint32(0, 0x52494646, false)  // "RIFF"
    view.setUint32(4, 36 + dataSize, true)  // File size - 8
    view.setUint32(8, 0x57415645, false)  // "WAVE"

    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false)  // "fmt "
    view.setUint32(16, 16, true)  // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true)  // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true)  // NumChannels
    view.setUint32(24, sampleRate, true)  // SampleRate
    view.setUint32(28, byteRate, true)  // ByteRate
    view.setUint16(32, blockAlign, true)  // BlockAlign
    view.setUint16(34, bitsPerSample, true)  // BitsPerSample

    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false)  // "data"
    view.setUint32(40, dataSize, true)  // Subchunk2Size

    return new Uint8Array(header)
  }

  // Funzione per salvare audio come WAV sul server
  const saveAudioAsWav = async (audioChunks: Int16Array[]) => {
    // Calcola lunghezza totale
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)

    // Concatena tutti i chunks in un unico array
    const fullAudio = new Int16Array(totalLength)
    let offset = 0
    for (const chunk of audioChunks) {
      fullAudio.set(chunk, offset)
      offset += chunk.length
    }

    // Crea header WAV
    const header = createWavHeader(fullAudio.length)
    const audioBytes = new Uint8Array(fullAudio.buffer)

    // Combina header + audio data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wavFile = new Blob([header, audioBytes] as any[], { type: 'audio/wav' })

    const durationSec = fullAudio.length / 4000
    console.log(`💾 Salvataggio file WAV...`)
    console.log(`   Samples: ${fullAudio.length}`)
    console.log(`   Durata: ${durationSec.toFixed(1)}s`)

    // Salva sul server tramite API
    const formData = new FormData()
    formData.append('audio', wavFile, 'recording.wav')
    formData.append('patientCode', patientCode)
    formData.append('mode', recordingMode)

    const response = await fetch('/api/stetoscopio/save-recording', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Errore salvataggio file sul server')
    }

    const result = await response.json()
    console.log(`✅ File salvato: ${result.filename}`)
    console.log(`   Path: ${result.path}`)

    return result.filename
  }

  // Funzione per cambiare modalità (Cuore/Polmoni)
  const changeRecordingMode = async (mode: 'heart' | 'lung') => {
    if (!writeCharacteristic) return

    try {
      // Invia comando al dispositivo: 0x00 = Cuore, 0x01 = Polmoni
      const command = mode === 'heart' ? 0x00 : 0x01
      await writeCharacteristic.writeValue(new Uint8Array([command]))

      setRecordingMode(mode)
      console.log(`🔄 Modalità cambiata: ${mode === 'heart' ? 'Cuore (20-200 Hz)' : 'Polmoni (200-2000 Hz)'}`)
    } catch (error) {
      console.error('❌ Errore cambio modalità:', error)
    }
  }

  // Funzione per connettere il dispositivo Stetoscopio
  const handleConnectDevice = async () => {
    try {
      setConnectionStatus('connecting')
      setErrorMessage('')
      setStatus('🔍 Ricerca stetoscopio LINKTOP...')

      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth non supportato')
      }

      // UUID del servizio principale STETOSCOPIO (NORDIC UART Service)
      const AUDIO_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'

      const stethoscopeServices = [
        AUDIO_SERVICE_UUID,                      // NORDIC UART Audio Service
        '0000180a-0000-1000-8000-00805f9b34fb',  // Device Information
        '0000180f-0000-1000-8000-00805f9b34fb',  // Battery Service
      ]

      // Richiedi dispositivo con prefisso "HC-" (Stetoscopio)
      const bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'HC-' }  // Stetoscopio: HC-21, HC-22, etc
        ],
        optionalServices: stethoscopeServices
      })

      setStatus('🔌 Connessione in corso...')

      if (!bluetoothDevice.gatt) {
        throw new Error('GATT non disponibile')
      }

      const server = await bluetoothDevice.gatt.connect()
      console.log('✅ GATT connesso')

      const deviceName = bluetoothDevice.name || 'Stetoscopio'

      // Listener per disconnessione
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        console.log('🔌 Dispositivo disconnesso')
        setStatus('⚠️ Dispositivo disconnesso')
        setConnectionStatus('disconnected')
        setDevice(prev => ({ ...prev, isConnected: false }))
        setBluetoothDevice(null)
        setGattServer(null)
      })

      setBluetoothDevice(bluetoothDevice)
      setGattServer(server)

      // Leggi servizio audio NORDIC UART e caratteristiche
      const service = await server.getPrimaryService(AUDIO_SERVICE_UUID)
      console.log('✅ Servizio Audio trovato:', service.uuid)

      const characteristics = await service.getCharacteristics()
      console.log(`✅ Trovate ${characteristics.length} caratteristiche`)

      // TX Characteristic (Audio Stream - NOTIFY)
      const txChar = characteristics.find(c =>
        c.uuid === '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
      )

      // RX Characteristic (Control - WRITE)
      const rxChar = characteristics.find(c =>
        c.uuid === '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
      )

      if (txChar && rxChar) {
        console.log('✅ TX Characteristic (Audio Stream):', txChar.uuid)
        console.log('✅ RX Characteristic (Control):', rxChar.uuid)

        setNotifyCharacteristic(txChar)
        setWriteCharacteristic(rxChar)

        // Setup listener per audio data PRIMA di abilitare notifiche
        txChar.addEventListener('characteristicvaluechanged', handleAudioData)

        // Abilita notifiche su TX per ricevere audio stream
        await txChar.startNotifications()
        console.log('✅ Notifiche audio abilitate su TX characteristic')

        // Imposta modalità Cuore come default
        await rxChar.writeValue(new Uint8Array([0x00]))  // 0x00 = Heart Mode
        console.log('✅ Modalità Cuore impostata (20-200 Hz)')
      } else {
        throw new Error('Caratteristiche TX/RX non trovate')
      }

      setDevice({
        deviceId: bluetoothDevice.id,
        deviceName,
        isConnected: true,
        batteryLevel: 100 // TODO: Leggere batteria reale
      })

      setStatus(`✅ Connesso a: ${deviceName}`)
      setConnectionStatus('connected')

    } catch (error: any) {
      console.error('Errore connessione:', error)
      let errorMsg = ''
      if (error.name === 'NotFoundError') {
        errorMsg = '⚠️ Selezione annullata o nessun dispositivo trovato'
      } else {
        errorMsg = `❌ Errore: ${error.message}`
      }
      setStatus(errorMsg)
      setErrorMessage(errorMsg)
      setConnectionStatus('disconnected')
    }
  }

  // Disconnetti dispositivo
  const handleDisconnect = () => {
    console.log('🔌 Disconnessione dispositivo...')

    // Ferma registrazione se attiva
    if (isRecording) {
      stopRecording()
    }

    // Rimuovi listener audio
    if (notifyCharacteristic) {
      notifyCharacteristic.removeEventListener('characteristicvaluechanged', handleAudioData)
    }

    // Disconnetti GATT
    if (bluetoothDevice?.gatt?.connected) {
      bluetoothDevice.gatt.disconnect()
    }

    // Reset stato
    setBluetoothDevice(null)
    setGattServer(null)
    setNotifyCharacteristic(null)
    setWriteCharacteristic(null)
    setDevice(prev => ({ ...prev, isConnected: false }))
    setConnectionStatus('disconnected')
    setStatus('Pronto per la connessione')

    // Pulisci buffer audio e ref
    audioBufferRef.current = []
    isRecordingRef.current = false

    console.log('✅ Dispositivo disconnesso')
  }

  // Avvia registrazione
  const startRecording = async () => {
    if (!device.isConnected || !notifyCharacteristic) {
      setStatus('⚠️ Connetti prima il stetoscopio')
      return
    }

    // Pulisci buffer audio e inizia a registrare
    audioBufferRef.current = []
    isRecordingRef.current = true  // Imposta REF (per l'handler)
    setIsRecording(true)  // Imposta STATE (per UI)
    setRecordingDuration(0)
    setStatus('🎙️ Registrazione in corso...')

    // Timer per durata registrazione
    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1)
    }, 1000)

    console.log('🎙️ Registrazione avviata - il dispositivo sta già inviando audio')
    console.log('📍 Posiziona lo stetoscopio sul petto/schiena del paziente')
  }

  // Ferma registrazione
  const stopRecording = async () => {
    isRecordingRef.current = false  // Imposta REF (per l'handler)
    setIsRecording(false)  // Imposta STATE (per UI)

    // Ferma timer
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    console.log(`⏹️ Registrazione fermata: ${recordingDuration}s`)
    console.log(`📊 Chunks ricevuti: ${audioBufferRef.current.length}`)

    // Salva registrazione se ci sono dati
    if (audioBufferRef.current.length > 0) {
      try {
        setStatus('💾 Salvataggio in corso...')
        const filename = await saveAudioAsWav(audioBufferRef.current)
        setStatus(`✅ Registrazione salvata: ${filename} (${recordingDuration}s)`)
      } catch (error) {
        console.error('❌ Errore salvataggio:', error)
        setStatus(`❌ Errore durante il salvataggio`)
      }
    } else {
      setStatus(`⚠️ Nessun audio ricevuto durante la registrazione`)
      console.warn('⚠️ Nessun dato audio ricevuto - verifica che il dispositivo stia inviando dati')
    }
  }

  // Formatta tempo in MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800">
      {/* Background Animation */}
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
                  <Stethoscope className="w-8 h-8" />
                  Stetoscopio Digitale
                </h1>
                <p className="text-gray-300 mt-1">Registrazione auscultazioni cardiache e polmonari</p>
              </div>
            </div>

            {device.isConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-semibold transition-all border border-red-500/30"
              >
                Disconnetti
              </button>
            ) : (
              <button
                onClick={handleConnectDevice}
                disabled={connectionStatus === 'connecting'}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
              >
                {connectionStatus === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                {connectionStatus === 'connecting' ? 'Connessione...' : 'Connetti Stetoscopio'}
              </button>
            )}
          </div>
        </header>

        <div className="relative z-10 p-8">
          {/* Status Message */}
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            errorMessage
              ? 'bg-red-500/20 border border-red-500/30 text-red-300'
              : device.isConnected
              ? 'bg-green-500/20 border border-green-500/30 text-green-300'
              : 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
          }`}>
            {errorMessage ? <AlertTriangle className="w-5 h-5" /> : device.isConnected ? <CheckCircle className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
            {status}
          </div>

          {/* Device Info */}
          {device.isConnected && (
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">Dispositivo Connesso</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Nome</p>
                  <p className="text-white font-semibold">{device.deviceName}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">ID</p>
                  <p className="text-white font-mono text-sm">{device.deviceId.substring(0, 16)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          {device.isConnected && (
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                🎙️ Registrazione Audio
              </h2>

              {/* Patient Code Input */}
              <div className="mb-6">
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Codice/Nome Paziente (opzionale)
                </label>
                <input
                  type="text"
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value)}
                  placeholder="es: PAZ001, Mario Rossi"
                  disabled={isRecording}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>

              {/* Recording Mode Toggle */}
              <div className="mb-6">
                <label className="block text-gray-300 text-sm font-semibold mb-3">
                  Modalità di Ascolto
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => changeRecordingMode('heart')}
                    disabled={isRecording}
                    className={`px-6 py-4 rounded-xl font-semibold transition-all ${
                      recordingMode === 'heart'
                        ? 'bg-red-500 text-white shadow-lg'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    } disabled:opacity-50`}
                  >
                    ❤️ Cuore
                    <div className="text-xs mt-1 opacity-80">20-200 Hz</div>
                  </button>
                  <button
                    onClick={() => changeRecordingMode('lung')}
                    disabled={isRecording}
                    className={`px-6 py-4 rounded-xl font-semibold transition-all ${
                      recordingMode === 'lung'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    } disabled:opacity-50`}
                  >
                    🫁 Polmoni
                    <div className="text-xs mt-1 opacity-80">200-2000 Hz</div>
                  </button>
                </div>
              </div>

              {/* Recording Timer */}
              {isRecording && (
                <div className="mb-6 text-center">
                  <div className="text-6xl font-mono font-bold text-red-400 animate-pulse">
                    {formatDuration(recordingDuration)}
                  </div>
                  <p className="text-gray-300 mt-2">Registrazione in corso...</p>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex gap-4 justify-center">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-bold text-lg flex items-center gap-3 hover:opacity-90 transition-all shadow-lg"
                  >
                    <Play className="w-6 h-6" />
                    Avvia Registrazione
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold text-lg flex items-center gap-3 hover:opacity-90 transition-all shadow-lg"
                  >
                    <Square className="w-6 h-6" />
                    Ferma Registrazione
                  </button>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <h3 className="text-white font-semibold mb-2">💡 Come usare lo stetoscopio:</h3>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Connetti il stetoscopio LINKTOP via Bluetooth</li>
                  <li>Posiziona lo stetoscopio sul petto o schiena del paziente</li>
                  <li>Clicca "Avvia Registrazione" e ascolta i suoni</li>
                  <li>Clicca "Ferma Registrazione" quando hai finito</li>
                  <li>La registrazione verrà salvata automaticamente nel database</li>
                </ol>
              </div>
            </div>
          )}

          {/* Info quando non connesso */}
          {!device.isConnected && (
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
              <Stethoscope className="w-24 h-24 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Nessun dispositivo connesso</h2>
              <p className="text-gray-300 mb-6">
                Clicca sul pulsante "Connetti Stetoscopio" per iniziare
              </p>
              <p className="text-gray-400 text-sm">
                Assicurati che il dispositivo sia acceso e nel raggio Bluetooth
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
