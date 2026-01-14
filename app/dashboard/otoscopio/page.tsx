'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, Video, Square, AlertTriangle, CheckCircle, Eye, RefreshCw } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

export default function OtoscopioPage() {
  const [status, setStatus] = useState<string>('Pronto per la connessione')
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [patientCode, setPatientCode] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [zoomLevel, setZoomLevel] = useState<number>(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Carica lista telecamere disponibili
  useEffect(() => {
    loadCameras()
  }, [])

  // Cleanup al unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Imposta srcObject quando isConnected diventa true e abbiamo uno stream
  useEffect(() => {
    if (isConnected && mediaStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current
    }
  }, [isConnected])

  // Carica lista di tutte le telecamere disponibili
  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setAvailableCameras(videoDevices)
    } catch (error) {
      console.error('Errore caricamento telecamere:', error)
    }
  }

  // Connetti alla telecamera USB (otoscopio)
  const connectCamera = async () => {
    try {
      setStatus('🔍 Connessione otoscopio USB...')
      setErrorMessage('')

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      mediaStreamRef.current = stream
      setIsConnected(true)
      setStatus('✅ Otoscopio USB connesso')
    } catch (error: any) {
      console.error('❌ Errore connessione otoscopio:', error)
      let errorMsg = ''
      if (error.name === 'NotAllowedError') {
        errorMsg = '⚠️ Permesso camera negato. Consenti l\'accesso alla telecamera.'
      } else if (error.name === 'NotFoundError') {
        errorMsg = '⚠️ Nessuna telecamera trovata. Collega l\'otoscopio USB.'
      } else {
        errorMsg = `❌ Errore: ${error.message}`
      }
      setStatus(errorMsg)
      setErrorMessage(errorMsg)
    }
  }

  const stopCamera = () => {
    if (isRecording) stopRecording()
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsConnected(false)
    setStatus('Pronto per la connessione')
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !isConnected) {
      setStatus('⚠️ Connetti prima l\'otoscopio')
      return
    }
    try {
      setStatus('📸 Cattura foto in corso...')
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context non disponibile')

      // Applica lo zoom reale alla foto catturata
      if (zoomLevel > 1) {
        // Calcola l'area da catturare (centro dell'immagine)
        const sourceWidth = video.videoWidth / zoomLevel
        const sourceHeight = video.videoHeight / zoomLevel
        const sourceX = (video.videoWidth - sourceWidth) / 2
        const sourceY = (video.videoHeight - sourceHeight) / 2

        // Imposta dimensioni canvas alla risoluzione originale
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Disegna solo la parte centrale ingrandita
        ctx.drawImage(
          video,
          sourceX, sourceY, sourceWidth, sourceHeight,  // Area sorgente (crop)
          0, 0, canvas.width, canvas.height             // Destinazione (ingrandita)
        )
      } else {
        // Nessuno zoom - cattura normale
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Errore conversione foto')), 'image/jpeg', 0.95)
      })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `${patientCode ? patientCode + '_' : ''}otoscopio_${timestamp}.jpg`
      const formData = new FormData()
      formData.append('photo', blob, filename)
      formData.append('patientCode', patientCode)
      formData.append('zoom', zoomLevel.toString())
      const response = await fetch('/api/otoscopio/save-photo', { method: 'POST', body: formData })
      if (!response.ok) throw new Error('Errore salvataggio foto sul server')
      const result = await response.json()
      setStatus(`✅ Foto salvata (${zoomLevel.toFixed(1)}x zoom): ${result.filename}`)
    } catch (error) {
      console.error('❌ Errore cattura foto:', error)
      setStatus('❌ Errore durante la cattura')
    }
  }

  const startRecording = async () => {
    if (!mediaStreamRef.current || !isConnected) {
      setStatus('⚠️ Connetti prima l\'otoscopio')
      return
    }
    try {
      recordedChunksRef.current = []
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, { mimeType: 'video/webm;codecs=vp9' })
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      setStatus('🎥 Registrazione in corso...')
      recordingIntervalRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000)
      console.log('🎥 Registrazione video avviata')
    } catch (error) {
      console.error('❌ Errore avvio registrazione:', error)
      setStatus('❌ Errore avvio registrazione')
    }
  }

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return
    setIsRecording(false)
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
    await new Promise<void>((resolve) => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => resolve()
        mediaRecorderRef.current.stop()
      } else resolve()
    })
    if (recordedChunksRef.current.length > 0) {
      try {
        setStatus('💾 Salvataggio video in corso...')
        const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const filename = `${patientCode ? patientCode + '_' : ''}otoscopio_video_${timestamp}.webm`
        const formData = new FormData()
        formData.append('video', videoBlob, filename)
        formData.append('patientCode', patientCode)
        formData.append('duration', recordingDuration.toString())
        const response = await fetch('/api/otoscopio/save-video', { method: 'POST', body: formData })
        if (!response.ok) throw new Error('Errore salvataggio video sul server')
        const result = await response.json()
        setStatus(`✅ Video salvato: ${result.filename} (${recordingDuration}s)`)
      } catch (error) {
        console.error('❌ Errore salvataggio video:', error)
        setStatus('❌ Errore durante il salvataggio')
      }
    }
    recordedChunksRef.current = []
    mediaRecorderRef.current = null
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-700 to-blue-800">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
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
                  <Eye className="w-8 h-8" />
                  Otoscopio Digitale USB
                </h1>
                <p className="text-gray-300 mt-1">Esame otoscopico - Foto e video dell'orecchio</p>
              </div>
            </div>
            {isConnected ? (
              <button onClick={stopCamera} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-semibold transition-all border border-red-500/30">Disconnetti</button>
            ) : (
              <button onClick={connectCamera} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg">
                <Camera className="w-4 h-4" />
                Connetti Otoscopio
              </button>
            )}
          </div>
        </header>
        <div className="relative z-10 p-8">
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${errorMessage ? 'bg-red-500/20 border border-red-500/30 text-red-300' : isConnected ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 'bg-blue-500/20 border border-blue-500/30 text-blue-300'}`}>
            {errorMessage ? <AlertTriangle className="w-5 h-5" /> : isConnected ? <CheckCircle className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
            {status}
          </div>
          {isConnected && (
            <>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Anteprima Live</h2>
                <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center'
                    }}
                  />
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full font-bold animate-pulse">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                      REC
                    </div>
                  )}
                </div>
                {/* Slider Zoom */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-300 text-sm font-semibold">
                      🔍 Zoom: {zoomLevel.toFixed(1)}x
                    </label>
                    <button
                      onClick={() => setZoomLevel(1)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 text-xs rounded-lg transition-all"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="0.1"
                    value={zoomLevel}
                    onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1x</span>
                    <span>2x</span>
                    <span>3x</span>
                    <span>4x</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-6">📸 Controlli</h2>
                <div className="mb-6">
                  <label className="block text-gray-300 text-sm font-semibold mb-2">Codice/Nome Paziente (opzionale)</label>
                  <input type="text" value={patientCode} onChange={(e) => setPatientCode(e.target.value)} placeholder="es: PAZ001, Mario Rossi" disabled={isRecording} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50" />
                </div>
                {isRecording && (
                  <div className="mb-6 text-center">
                    <div className="text-6xl font-mono font-bold text-red-400 animate-pulse">{formatDuration(recordingDuration)}</div>
                    <p className="text-gray-300 mt-2">Registrazione video in corso...</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={capturePhoto} disabled={isRecording} className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg disabled:opacity-50">
                    <Camera className="w-6 h-6" />
                    Cattura Foto
                  </button>
                  {!isRecording ? (
                    <button onClick={startRecording} className="px-6 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg">
                      <Video className="w-6 h-6" />
                      Registra Video
                    </button>
                  ) : (
                    <button onClick={stopRecording} className="px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg">
                      <Square className="w-6 h-6" />
                      Ferma Video
                    </button>
                  )}
                </div>
                <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <h3 className="text-white font-semibold mb-2">💡 Come usare l'otoscopio:</h3>
                  <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                    <li>Collega l'otoscopio USB al computer</li>
                    <li>Clicca "Connetti Otoscopio" e consenti l'accesso alla telecamera</li>
                    <li>Inserisci delicatamente l'otoscopio nell'orecchio del paziente</li>
                    <li>Clicca "Cattura Foto" per scattare una foto</li>
                    <li>Oppure clicca "Registra Video" per registrare un video</li>
                    <li>Le foto e i video vengono salvati automaticamente sul server</li>
                  </ol>
                </div>
              </div>
            </>
          )}
          {!isConnected && (
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
              <Eye className="w-24 h-24 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Nessun dispositivo connesso</h2>
              <p className="text-gray-300 mb-6">Clicca sul pulsante "Connetti Otoscopio" per iniziare</p>

              {/* Selettore telecamera */}
              {availableCameras.length > 0 && (
                <div className="mb-6 max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-300 text-sm font-semibold">
                      📹 Seleziona Telecamera ({availableCameras.length} disponibili):
                    </label>
                    <button
                      onClick={loadCameras}
                      className="p-2 hover:bg-white/10 rounded-lg transition-all"
                      title="Ricarica lista telecamere"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-300" />
                    </button>
                  </div>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {availableCameras.map((camera, idx) => (
                      <option key={camera.deviceId} value={camera.deviceId} className="bg-gray-800">
                        {camera.label || `Telecamera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-gray-400 text-xs mt-2">
                    💡 Seleziona l'otoscopio USB dalla lista. Di solito è l'ultima telecamera.
                  </p>
                </div>
              )}

              <p className="text-gray-400 text-sm">Assicurati che l'otoscopio USB sia collegato al computer</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
