'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Activity, Droplet, Thermometer, ArrowLeft, Zap, Bluetooth } from 'lucide-react'

interface Utente {
  id: number
  nome: string
  cognome: string
}

export default function UtenteHeartMonitorPage() {
  const router = useRouter()
  const [utente, setUtente] = useState<Utente | null>(null)

  // BLE States
  const [device, setDevice] = useState<{ isConnected: boolean; name: string } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const isMeasuringRef = useRef<boolean>(false)

  // Characteristics
  const notifyCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const writeCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const deviceRef = useRef<BluetoothDevice | null>(null)

  // Calibration offsets (loaded from localStorage)
  const spo2OffsetRef = useRef<number>(4)
  const hrOffsetRef = useRef<number>(0)
  const bpSystolicOffsetRef = useRef<number>(0)
  const bpDiastolicOffsetRef = useRef<number>(0)
  const temperatureOffsetRef = useRef<number>(0)

  // Timer per barra progresso SpO2
  const [spo2Progress, setSpo2Progress] = useState(0)
  const [spo2TimerStarted, setSpo2TimerStarted] = useState(false)
  const [spo2TimerCompleted, setSpo2TimerCompleted] = useState(false)
  const spo2TimerCompletedRef = useRef<boolean>(false)
  const spo2TimerRef = useRef<NodeJS.Timeout | null>(null)
  const MEASUREMENT_DURATION = 15 // 15 secondi

  // Results
  const [measurements, setMeasurements] = useState({
    spo2: 0,
    heartRate: 0,
    systolic: 0,
    diastolic: 0,
    temperature: 0
  })

  // Buffer per calcolare SpO2/HR dai campioni RAW PPG
  const ppgSamplesRef = useRef<{red: number[], ir: number[]}>({red: [], ir: []})
  const lastPeakTimeRef = useRef<number>(0)
  const peakIntervalsRef = useRef<number[]>([])
  const spo2HistoryRef = useRef<number[]>([])
  const finalMeasurementsRef = useRef<{spo2: number[], hr: number[]}>({spo2: [], hr: []})

  // BP: accumulo valori pressione
  const bpPressureArrayRef = useRef<number[]>([])
  const bpTimerRef = useRef<NodeJS.Timeout | null>(null)
  const bpCalibrationRef = useRef<{
    C1: number, C2: number, C3: number, C4: number, C5: number,
    sensibility: number,
    baseline: number,
    sampleCount: number,
    baselineSum: number
  }>({
    C1: 0, C2: 0, C3: 0, C4: 0, C5: 0,
    sensibility: 0, baseline: 0, sampleCount: 0, baselineSum: 0
  })

  // Buffer per riassemblare pacchetti frammentati
  const packetBufferRef = useRef<Uint8Array>(new Uint8Array(0))
  const expectedPacketLengthRef = useRef<number>(0)

  // Load calibration offsets from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const spo2Offset = localStorage.getItem('linktop_spo2_calibration_offset')
      if (spo2Offset) spo2OffsetRef.current = parseInt(spo2Offset, 10)

      const hrOffset = localStorage.getItem('linktop_hr_calibration_offset')
      if (hrOffset) hrOffsetRef.current = parseInt(hrOffset, 10)

      const bpSystolicOffset = localStorage.getItem('linktop_bp_systolic_offset')
      if (bpSystolicOffset) bpSystolicOffsetRef.current = parseInt(bpSystolicOffset, 10)

      const bpDiastolicOffset = localStorage.getItem('linktop_bp_diastolic_offset')
      if (bpDiastolicOffset) bpDiastolicOffsetRef.current = parseInt(bpDiastolicOffset, 10)

      const tempOffset = localStorage.getItem('linktop_temperature_offset')
      if (tempOffset) temperatureOffsetRef.current = parseFloat(tempOffset)

      console.log('📊 Calibrazione caricata:', {
        spo2: spo2OffsetRef.current,
        hr: hrOffsetRef.current,
        bpSystolic: bpSystolicOffsetRef.current,
        bpDiastolic: bpDiastolicOffsetRef.current,
        temp: temperatureOffsetRef.current
      })
    }
  }, [])

  // Load user data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const utenteData = sessionStorage.getItem('linktop_utente')
      if (!utenteData) {
        router.push('/utente')
        return
      }
      setUtente(JSON.parse(utenteData))
    }
  }, [router])

  // Helper per sincronizzare stato e ref
  const updateMeasuringState = useCallback((measuring: boolean) => {
    setIsMeasuring(measuring)
    isMeasuringRef.current = measuring
  }, [])

  const playBeep = useCallback((frequency: number = 800, duration: number = 200) => {
    try {
      if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) return
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration / 1000)
    } catch (e) {
      console.warn('Audio not available:', e)
    }
  }, [])

  // Funzione per calcolare la mediana
  const calculateMedian = useCallback((values: number[]): number => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]
  }, [])

  // Algoritmo per calcolare HR e SpO2 dai campioni PPG RAW - DALLA PAGINA STAFF
  const calculateVitals = useCallback(() => {
    const { red, ir } = ppgSamplesRef.current
    if (red.length < 100 || ir.length < 100) {
      return { hr: 0, spo2: 0 }
    }

    const irSamples = ir.slice(-150)
    const irMean = irSamples.reduce((a, b) => a + b, 0) / irSamples.length
    const irStd = Math.sqrt(irSamples.reduce((a, b) => a + Math.pow(b - irMean, 2), 0) / irSamples.length)

    const threshold = irMean + (irStd * 0.5)
    let peaks = 0
    let lastPeak = -50

    for (let i = 2; i < irSamples.length - 2; i++) {
      const isLocalMax =
        irSamples[i] > threshold &&
        irSamples[i] > irSamples[i - 1] &&
        irSamples[i] > irSamples[i - 2] &&
        irSamples[i] >= irSamples[i + 1] &&
        irSamples[i] > irSamples[i + 2] &&
        i - lastPeak > 50

      if (isLocalMax) {
        peaks++
        lastPeak = i
      }
    }

    const durationSec = irSamples.length / 125
    let hr = Math.round((peaks / durationSec) * 60)

    if (hr > 115 && hr < 160) {
      hr = Math.round(hr / 2)
    }

    const hrCorrected = Math.round(hr * 0.64)
    hr = hrCorrected

    // Applica calibrazione HR caricata da localStorage
    hr = hr + hrOffsetRef.current

    // SpO2 - Algoritmo con 4 formule e mediana
    const redSamples = red.slice(-150)
    const redMean = redSamples.reduce((a, b) => a + b, 0) / redSamples.length
    const redMax = Math.max(...redSamples)
    const redMin = Math.min(...redSamples)
    const acRed = (redMax - redMin) / 2
    const dcRed = redMean

    const irMax = Math.max(...irSamples)
    const irMin = Math.min(...irSamples)
    const acIr = (irMax - irMin) / 2
    const dcIr = irMean

    if (dcRed > 0 && dcIr > 0 && acRed > 0 && acIr > 0) {
      const R = (acRed / dcRed) / (acIr / dcIr)

      const formulas = [
        { name: 'LINKTOP v1', value: Math.round(70 + 28 * R) },
        { name: 'LINKTOP v2', value: Math.round(110 - 25 * R) + 11 },
        { name: 'LINKTOP v3', value: Math.round(97 + (1 - R) * 20) },
        { name: 'LINKTOP v4', value: Math.round(102 - (R - 0.8) * 10) },
      ]

      const linktopValues = formulas
        .filter(f => f.name.includes('LINKTOP'))
        .map(f => f.value)
        .sort((a, b) => a - b)

      const medianIndex = Math.floor(linktopValues.length / 2)
      let rawSpo2 = linktopValues[medianIndex]

      spo2HistoryRef.current.push(rawSpo2)
      if (spo2HistoryRef.current.length > 5) {
        spo2HistoryRef.current.shift()
      }

      const avgSpo2 = Math.round(
        spo2HistoryRef.current.reduce((a, b) => a + b, 0) / spo2HistoryRef.current.length
      )

      // Applica calibrazione SpO2 caricata da localStorage
      let spo2 = avgSpo2 + spo2OffsetRef.current

      // Clamp tra 90-100% (dopo calibrazione)
      spo2 = Math.max(90, Math.min(100, spo2))

      const validHr = hr >= 40 && hr <= 150 ? hr : 0

      return { hr: validHr, spo2 }
    }

    return { hr: 0, spo2: 0 }
  }, [])

  // Avvia timer SpO2 con barra progresso
  const startSpo2Timer = useCallback(() => {
    if (spo2TimerRef.current !== null || spo2TimerCompletedRef.current) {
      return
    }

    console.log('⏱️ Timer SpO2 avviato (15 secondi)')
    setSpo2TimerStarted(true)
    setSpo2TimerCompleted(false)
    spo2TimerCompletedRef.current = false
    setSpo2Progress(0)

    finalMeasurementsRef.current = { spo2: [], hr: [] }

    playBeep(800, 150)

    let elapsed = 0
    const interval = 100

    spo2TimerRef.current = setInterval(() => {
      elapsed += interval
      const progress = Math.min((elapsed / (MEASUREMENT_DURATION * 1000)) * 100, 100)
      setSpo2Progress(progress)

      if (progress >= 100) {
        if (spo2TimerRef.current) {
          clearInterval(spo2TimerRef.current)
          spo2TimerRef.current = null
        }
        setSpo2TimerCompleted(true)
        spo2TimerCompletedRef.current = true

        updateMeasuringState(false)

        if (finalMeasurementsRef.current.spo2.length === 0) {
          console.error('❌ ERRORE: Nessun valore SpO2 raccolto!')
          playBeep(400, 300)
          return
        }

        const finalSpo2 = calculateMedian(finalMeasurementsRef.current.spo2)
        const finalHr = finalMeasurementsRef.current.hr.length > 0
          ? calculateMedian(finalMeasurementsRef.current.hr)
          : 0

        // Apply calibration
        const calibratedSpo2 = finalSpo2 + spo2OffsetRef.current
        const calibratedHr = finalHr + hrOffsetRef.current

        console.log(`📊 RISULTATI FINALI: SpO2: ${calibratedSpo2}% | HR: ${calibratedHr} BPM`)
        console.log(`📊 Valori raw: SpO2: ${finalSpo2}% | HR: ${finalHr} BPM`)
        console.log(`📊 Offset applicati: SpO2: ${spo2OffsetRef.current} | HR: ${hrOffsetRef.current}`)

        setMeasurements(prev => {
          const newMeasurements = {
            ...prev,
            heartRate: calibratedHr,
            spo2: calibratedSpo2
          }
          console.log('📊 setMeasurements chiamato con:', newMeasurements)
          return newMeasurements
        })

        playBeep(1200, 300)
      }
    }, interval)
  }, [updateMeasuringState, playBeep, calculateMedian])

  // Reset timer SpO2
  const resetSpo2Timer = useCallback(() => {
    if (spo2TimerRef.current) {
      clearInterval(spo2TimerRef.current)
      spo2TimerRef.current = null
    }
    setSpo2TimerStarted(false)
    setSpo2TimerCompleted(false)
    spo2TimerCompletedRef.current = false
    setSpo2Progress(0)
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (spo2TimerRef.current) {
        clearInterval(spo2TimerRef.current)
      }
      if (bpTimerRef.current) {
        clearTimeout(bpTimerRef.current)
      }
    }
  }, [])

  // Algoritmo oscillometrico per calcolare BP
  const calculateBP = useCallback((pressureArray: number[]): { systolic: number, diastolic: number, hr: number } => {
    console.log('🩺 Analisi BP: array con', pressureArray.length, 'valori')

    if (pressureArray.length < 50) {
      console.warn('⚠️ Troppo pochi dati per analisi BP')
      return { systolic: 0, diastolic: 0, hr: 0 }
    }

    const maxPressure = Math.max(...pressureArray)
    const meanPressure = pressureArray.reduce((a, b) => a + b, 0) / pressureArray.length

    const oscillations = pressureArray.map((p, i) => {
      if (i === 0 || i === pressureArray.length - 1) return 0
      return Math.abs(p - pressureArray[i - 1])
    })

    const maxOscillation = Math.max(...oscillations)
    const systolicIdx = oscillations.findIndex(o => o > maxOscillation * 0.5)
    const diastolicIdx = oscillations.length - 1 - oscillations.slice().reverse().findIndex(o => o > maxOscillation * 0.4)

    let systolic = systolicIdx > 0 ? pressureArray[systolicIdx] : maxPressure * 0.9
    let diastolic = diastolicIdx > 0 ? pressureArray[diastolicIdx] : meanPressure * 0.7

    systolic = Math.round(systolic * 0.75)
    diastolic = Math.round(diastolic * 0.6)

    // Apply calibration
    systolic += bpSystolicOffsetRef.current
    diastolic += bpDiastolicOffsetRef.current

    let peaks = 0
    for (let i = 1; i < oscillations.length - 1; i++) {
      if (oscillations[i] > oscillations[i-1] && oscillations[i] > oscillations[i+1]) {
        peaks++
      }
    }
    const hr = Math.round((peaks / (pressureArray.length / 50)) * 60)

    console.log(`🩺 BP calcolata: ${systolic}/${diastolic} mmHg, HR: ${hr} BPM`)

    return { systolic, diastolic, hr }
  }, [])

  // Handle BLE notifications - LOGICA DALLA PAGINA STAFF
  const handleNotification = useCallback((event: any) => {
    const value = event.target.value
    const newData = new Uint8Array(value.buffer)

    // Accumula nel buffer
    const combined = new Uint8Array(packetBufferRef.current.length + newData.length)
    combined.set(packetBufferRef.current)
    combined.set(newData, packetBufferRef.current.length)
    packetBufferRef.current = combined

    // Estrai pacchetti completi
    while (packetBufferRef.current.length >= 3) {
      if (packetBufferRef.current[0] !== 0x02) {
        // Cerca header 0x02
        const headerIdx = packetBufferRef.current.findIndex(b => b === 0x02)
        if (headerIdx === -1) {
          packetBufferRef.current = new Uint8Array(0)
          break
        }
        packetBufferRef.current = packetBufferRef.current.slice(headerIdx)
        continue
      }

      const payloadLen = packetBufferRef.current[1] | (packetBufferRef.current[2] << 8)
      const totalLen = 3 + 1 + 1 + payloadLen + 2 + 1

      if (packetBufferRef.current.length < totalLen) {
        expectedPacketLengthRef.current = totalLen
        break
      }

      const packet = packetBufferRef.current.slice(0, totalLen)
      packetBufferRef.current = packetBufferRef.current.slice(totalLen)
      expectedPacketLengthRef.current = 0

      const responseType = packet[4]
      console.log(`📦 Pacchetto completo ricevuto - Type: 0x${responseType.toString(16).toUpperCase()} (${responseType})`)
      console.log(`   Header: 0x${packet[0].toString(16)}, PayloadLen: ${payloadLen}, Total: ${totalLen} bytes`)

      // SpO2 e Heart Rate (0x84)
      if (responseType === 0x84 || responseType === 132) {
        console.log(`📡 Pacchetto 0x84 ricevuto (SpO2/HR)`)

        if (!isMeasuringRef.current || spo2TimerCompletedRef.current) {
          console.log(`⚠️ Pacchetto ignorato - isMeasuring: ${isMeasuringRef.current}, completed: ${spo2TimerCompletedRef.current}`)
          continue
        }

        if (spo2TimerRef.current === null && !spo2TimerCompletedRef.current) {
          console.log('⏱️ Avvio timer SpO2...')
          startSpo2Timer()
        }

        const payload = packet.slice(6, 6 + payloadLen)
        console.log(`📊 Payload length: ${payload.length} bytes`)

        for (let i = 0; i + 3 < payload.length; i += 4) {
          const redLow = payload[i]
          const redHigh = payload[i + 1]
          const irLow = payload[i + 2]
          const irHigh = payload[i + 3]

          const redValue = (redHigh << 8) | redLow
          const irValue = (irHigh << 8) | irLow

          ppgSamplesRef.current.red.push(redValue)
          ppgSamplesRef.current.ir.push(irValue)
        }

        console.log(`📊 PPG samples: RED=${ppgSamplesRef.current.red.length}, IR=${ppgSamplesRef.current.ir.length}`)

        if (ppgSamplesRef.current.red.length > 300) {
          ppgSamplesRef.current.red = ppgSamplesRef.current.red.slice(-250)
          ppgSamplesRef.current.ir = ppgSamplesRef.current.ir.slice(-250)
        }

        if (ppgSamplesRef.current.red.length >= 100) {
          const { hr, spo2 } = calculateVitals()
          console.log(`🔍 Valori calcolati: SpO2=${spo2}%, HR=${hr} BPM`)

          if (spo2 >= 90 && spo2 <= 100 && hr > 0) {
            finalMeasurementsRef.current.spo2.push(spo2)
            finalMeasurementsRef.current.hr.push(hr)
            console.log(`✅ Valori aggiunti: SpO2=${spo2}%, HR=${hr} BPM (Arrays: ${finalMeasurementsRef.current.spo2.length} values)`)
          } else {
            console.log(`⚠️ Valori scartati: SpO2=${spo2}%, HR=${hr} BPM`)
          }
        }
      }

      // Blood Pressure (0x81)
      if (responseType === 0x81 || responseType === 129) {
        const payload = packet.slice(6, 6 + payloadLen)

        if (payload.length >= 10 && payload[0] === 0x01) {
          const C1 = (payload[2] << 8) | payload[1]
          const C2 = (payload[4] << 8) | payload[3]
          const C3 = (payload[6] << 8) | payload[5]
          const C4 = (payload[8] << 8) | payload[7]
          const C5 = (payload[10] << 8) | payload[9]

          bpCalibrationRef.current = {
            C1, C2, C3, C4, C5,
            sensibility: C1 / 32768,
            baseline: 0,
            sampleCount: 0,
            baselineSum: 0
          }
          console.log('📋 BP Calibration ricevuta:', bpCalibrationRef.current)
        }

        if (payload[0] === 0x02) {
          for (let i = 1; i + 1 < payload.length; i += 2) {
            const rawValue = (payload[i + 1] << 8) | payload[i]
            const { sensibility, baseline, sampleCount } = bpCalibrationRef.current

            if (sampleCount < 10) {
              bpCalibrationRef.current.baselineSum += rawValue
              bpCalibrationRef.current.sampleCount++
              if (bpCalibrationRef.current.sampleCount === 10) {
                bpCalibrationRef.current.baseline = bpCalibrationRef.current.baselineSum / 10
              }
            } else {
              const pressure = (rawValue - baseline) * sensibility
              bpPressureArrayRef.current.push(pressure)
            }
          }
        }

        if (payload[0] === 0x03) {
          console.log('🏁 BP misurazione terminata')
          updateMeasuringState(false)

          const result = calculateBP(bpPressureArrayRef.current)

          setMeasurements(prev => ({
            ...prev,
            systolic: result.systolic,
            diastolic: result.diastolic
          }))

          bpPressureArrayRef.current = []
          playBeep(1200, 300)
        }
      }

      // Temperature (0x82)
      if (responseType === 0x82 || responseType === 130) {
        const payload = packet.slice(6, 6 + payloadLen)

        if (payload.length >= 4) {
          const bt = payload[0] + payload[1] / 10
          const et = payload[2] + payload[3] / 10
          let finalTemp = bt > 34 ? bt : (bt + et) / 2

          // Apply calibration
          finalTemp += temperatureOffsetRef.current

          console.log(`🌡️ Temperatura: ${finalTemp.toFixed(1)}°C`)

          setMeasurements(prev => ({
            ...prev,
            temperature: parseFloat(finalTemp.toFixed(1))
          }))

          updateMeasuringState(false)
          playBeep(1200, 300)
        }
      }
    }
  }, [updateMeasuringState, playBeep, calculateVitals, calculateBP, startSpo2Timer])

  const connectDevice = async () => {
    try {
      setConnecting(true)
      console.log('🔍 Step 1: Searching for BLE device...')

      const linktopServices = [
        '0000fff0-0000-1000-8000-00805f9b34fb',
        '0000180f-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
        '0000ff20-0000-1000-8000-00805f9b34fb',
        '0000ff21-0000-1000-8000-00805f9b34fb',
        '0000ff22-0000-1000-8000-00805f9b34fb',
        '0000ff23-0000-1000-8000-00805f9b34fb',
        '0000ff24-0000-1000-8000-00805f9b34fb',
        '0000ff25-0000-1000-8000-00805f9b34fb',
        '0000ff26-0000-1000-8000-00805f9b34fb',
        '0000ff27-0000-1000-8000-00805f9b34fb',
        '00001800-0000-1000-8000-00805f9b34fb',
        '00001801-0000-1000-8000-00805f9b34fb',
      ]

      const bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'HC' }],
        optionalServices: linktopServices
      })

      console.log('📱 Step 2: Device found:', bleDevice.name, bleDevice.id)
      deviceRef.current = bleDevice

      console.log('🔌 Step 3: Connecting to GATT server...')
      const server = await bleDevice.gatt!.connect()
      console.log('✅ Step 4: Connected to GATT server')

      console.log('🔍 Step 5: Discovering services...')
      const allServices = await server.getPrimaryServices()
      console.log(`📋 Found ${allServices.length} services`)

      let service = allServices.find(s => s.uuid === '0000fff0-0000-1000-8000-00805f9b34fb')

      if (!service) {
        console.log('⚠️ Service FFF0 not found, searching alternatives...')
        service = allServices.find(s =>
          s.uuid.includes('fff') ||
          s.uuid.includes('ff27') ||
          s.uuid.startsWith('0000ff')
        )
        if (!service) {
          throw new Error('Nessun servizio compatibile trovato sul dispositivo')
        }
        console.log(`✅ Alternative service found: ${service.uuid}`)
      }

      console.log('🔍 Step 6: Getting characteristics...')
      const characteristics = await service.getCharacteristics()
      console.log(`📋 Found ${characteristics.length} characteristics`)

      let notifyChar = characteristics.find(c => c.properties.notify)
      if (!notifyChar) {
        notifyChar = characteristics.find(c => c.properties.indicate)
      }

      let writeChar = characteristics.find(c =>
        c.properties.write || c.properties.writeWithoutResponse
      )

      if (!notifyChar || !writeChar) {
        console.warn('⚠️ Standard characteristics not found, trying by UUID...')
        try {
          notifyChar = await service.getCharacteristic('0000fff4-0000-1000-8000-00805f9b34fb')
          writeChar = await service.getCharacteristic('0000fff1-0000-1000-8000-00805f9b34fb')
        } catch (err) {
          throw new Error('Impossibile trovare le characteristics necessarie')
        }
      }

      notifyCharacteristicRef.current = notifyChar
      writeCharacteristicRef.current = writeChar

      console.log('🔔 Step 7: Starting notifications...')
      await notifyChar.startNotifications()

      console.log('👂 Step 8: Adding event listener...')
      notifyChar.addEventListener('characteristicvaluechanged', handleNotification as any)

      setDevice({ isConnected: true, name: bleDevice.name || 'Unknown' })
      playBeep(1000, 200)
      console.log('✅ Device connected successfully!')

    } catch (error: any) {
      console.error('❌ Connection error:', error)
      alert(`Errore di connessione: ${error.message}`)
    } finally {
      setConnecting(false)
    }
  }

  const disconnectDevice = async () => {
    if (deviceRef.current?.gatt?.connected) {
      if (notifyCharacteristicRef.current) {
        try {
          notifyCharacteristicRef.current.removeEventListener('characteristicvaluechanged', handleNotification as any)
        } catch (e) {
          console.log('⚠️ Could not remove event listener:', e)
        }
      }

      deviceRef.current.gatt.disconnect()
      setDevice(null)
      notifyCharacteristicRef.current = null
      writeCharacteristicRef.current = null
      deviceRef.current = null
      console.log('🔌 Device disconnected')
    }
  }

  // Gestisci disconnessione automatica
  useEffect(() => {
    if (!deviceRef.current) return

    const handleDisconnect = () => {
      console.log('⚠️ Device disconnected automatically')
      setDevice(null)
      notifyCharacteristicRef.current = null
      writeCharacteristicRef.current = null
    }

    deviceRef.current.addEventListener('gattserverdisconnected', handleDisconnect)

    return () => {
      deviceRef.current?.removeEventListener('gattserverdisconnected', handleDisconnect)
    }
  }, [deviceRef.current])

  // Spegni LED del dispositivo
  const turnOffLED = async () => {
    if (!writeCharacteristicRef.current) return

    try {
      const stopPayload = new Uint8Array([1])
      const stopCmd = new Uint8Array(10)

      stopCmd[0] = 0x01
      stopCmd[1] = stopPayload.length & 0xFF
      stopCmd[2] = (stopPayload.length >> 8) & 0xFF
      stopCmd[3] = 0x04
      stopCmd[4] = 0x04

      let checksum1 = 0
      for (let i = 0; i < 5; i++) {
        checksum1 ^= stopCmd[i]
      }
      stopCmd[5] = checksum1
      stopCmd[6] = stopPayload[0]

      let checksum2 = 0xFFFF
      for (let i = 0; i < 7; i++) {
        checksum2 = ((((checksum2 << 8) | ((checksum2 >> 8) & 0xFF)) & 0xFFFF) ^ stopCmd[i]) & 0xFFFF
        const temp = (checksum2 ^ ((checksum2 & 0xFF) >> 4)) & 0xFFFF
        const temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF
        checksum2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF
      }

      stopCmd[7] = checksum2 & 0xFF
      stopCmd[8] = (checksum2 >> 8) & 0xFF
      stopCmd[9] = 0xFF

      await writeCharacteristicRef.current.writeValue(stopCmd)

      console.log('💡 LED spento - Dispositivo resta connesso')
      playBeep(800, 200)

    } catch (error: any) {
      console.error('❌ Errore spegnimento LED:', error)
    }
  }

  // Invia comando BLE per avviare misurazione - PROTOCOLLO STAFF
  const startMeasurement = async (type: string) => {
    if (!device?.isConnected || !writeCharacteristicRef.current) {
      console.warn('⚠️ Device not connected')
      return
    }

    if (type === 'SpO2') {
      ppgSamplesRef.current = { red: [], ir: [] }
      lastPeakTimeRef.current = 0
      peakIntervalsRef.current = []
      spo2HistoryRef.current = []
      finalMeasurementsRef.current = { spo2: [], hr: [] }
      spo2TimerCompletedRef.current = false
      resetSpo2Timer()
      setMeasurements(prev => ({ ...prev, heartRate: 0, spo2: 0 }))
    }

    updateMeasuringState(true)

    if (type !== 'SpO2') {
      resetSpo2Timer()
    }

    try {
      const measureTypes: { [key: string]: number } = {
        'Pressione': 1,
        'Temperatura': 2,
        'SpO2': 4,
      }

      const measureCode = measureTypes[type]
      if (!measureCode) {
        throw new Error(`Tipo misurazione sconosciuto: ${type}`)
      }

      let payload: Uint8Array

      if (measureCode === 4) {
        payload = new Uint8Array([0])
        console.log('🫁 SpO2: usando payload [0]')
      } else if (measureCode === 1) {
        payload = new Uint8Array([1])
        bpPressureArrayRef.current = []
        bpCalibrationRef.current = {
          C1: 0, C2: 0, C3: 0, C4: 0, C5: 0,
          sensibility: 0, baseline: 0, sampleCount: 0, baselineSum: 0
        }
      } else if (measureCode === 2) {
        payload = new Uint8Array([0])
        console.log('🌡️ Temperatura: usando payload [0]')
      } else {
        payload = new Uint8Array([])
      }

      const cmd = new Uint8Array(9 + payload.length)
      cmd[0] = 0x01
      cmd[1] = payload.length & 0xFF
      cmd[2] = (payload.length >> 8) & 0xFF
      cmd[3] = 0x04
      cmd[4] = measureCode

      let checksum1 = 0
      for (let i = 0; i < 5; i++) {
        checksum1 ^= cmd[i]
      }
      cmd[5] = checksum1

      if (payload.length > 0) {
        cmd.set(payload, 6)
      }

      let checksum2 = 0xFFFF
      for (let i = 0; i < 6 + payload.length; i++) {
        checksum2 = ((((checksum2 << 8) | ((checksum2 >> 8) & 0xFF)) & 0xFFFF) ^ cmd[i]) & 0xFFFF
        const temp = (checksum2 ^ ((checksum2 & 0xFF) >> 4)) & 0xFFFF
        const temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF
        checksum2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF
      }

      const checksumPos = 6 + payload.length
      cmd[checksumPos] = checksum2 & 0xFF
      cmd[checksumPos + 1] = (checksum2 >> 8) & 0xFF
      cmd[checksumPos + 2] = 0xFF

      await writeCharacteristicRef.current.writeValue(cmd)
      console.log('📤 Command sent:', type)
      playBeep(800, 150)

      // BP: comandi addizionali
      if (measureCode === 1) {
        await new Promise(resolve => setTimeout(resolve, 500))

        const createBpCommand = (bpPayload: number[]) => {
          const payload = new Uint8Array(bpPayload)
          const cmd = new Uint8Array(9 + payload.length)
          cmd[0] = 0x01
          cmd[1] = payload.length & 0xFF
          cmd[2] = (payload.length >> 8) & 0xFF
          cmd[3] = 0x04
          cmd[4] = 1

          let checksum1 = 0
          for (let i = 0; i < 5; i++) {
            checksum1 ^= cmd[i]
          }
          cmd[5] = checksum1

          cmd.set(payload, 6)

          let checksum2 = 0xFFFF
          for (let i = 0; i < 6 + payload.length; i++) {
            checksum2 = ((((checksum2 << 8) | ((checksum2 >> 8) & 0xFF)) & 0xFFFF) ^ cmd[i]) & 0xFFFF
            const temp = (checksum2 ^ ((checksum2 & 0xFF) >> 4)) & 0xFFFF
            const temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF
            checksum2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF
          }

          const checksumPos = 6 + payload.length
          cmd[checksumPos] = checksum2 & 0xFF
          cmd[checksumPos + 1] = (checksum2 >> 8) & 0xFF
          cmd[checksumPos + 2] = 0xFF

          return cmd
        }

        await writeCharacteristicRef.current.writeValue(createBpCommand([2]))
        await new Promise(resolve => setTimeout(resolve, 200))
        await writeCharacteristicRef.current.writeValue(createBpCommand([3]))
      }

    } catch (error) {
      console.error('❌ Error starting measurement:', error)
      updateMeasuringState(false)
    }
  }

  if (!utente) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-pink-700 flex items-center justify-center">
        <div className="text-white text-2xl">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-pink-700 to-rose-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/utente/home')}
            className="p-4 bg-white/20 backdrop-blur-lg rounded-full shadow-lg hover:bg-white/30 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>

          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
            <Heart className="w-10 h-10" />
            Heart Monitor
          </h1>

          <div className="w-14" />
        </div>

        {/* Connection Section */}
        {!device?.isConnected ? (
          <div className="mb-8">
            <button
              onClick={connectDevice}
              disabled={connecting}
              className="w-full py-8 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-3xl font-bold text-3xl shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 border-4 border-white"
            >
              {connecting ? (
                <>
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  Connessione...
                </>
              ) : (
                <>
                  <Bluetooth className="w-12 h-12" />
                  Connetti Dispositivo
                </>
              )}
            </button>
            <p className="text-white/80 text-center mt-4 text-lg">
              Premi il pulsante per connettere il tuo Heart Monitor
            </p>
          </div>
        ) : (
          <>
            {/* Connected Indicator */}
            <div className="mb-6 bg-green-600 backdrop-blur-xl rounded-2xl p-4 border-4 border-white shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Bluetooth className="w-8 h-8 text-white" />
                  <div>
                    <p className="text-white font-bold text-xl">Dispositivo Connesso</p>
                    <p className="text-white/80 text-sm">{device.name}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={turnOffLED}
                  className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold transition-all text-lg"
                >
                  💡 Spegni LED
                </button>
                <button
                  onClick={disconnectDevice}
                  className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all text-lg"
                >
                  Disconnetti
                </button>
              </div>
            </div>

            {/* Measurement Buttons */}
            <div className="space-y-4 mb-8">
              <button
                onClick={() => startMeasurement('SpO2')}
                disabled={isMeasuring}
                className="w-full py-6 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-bold text-2xl shadow-xl hover:shadow-cyan-500/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Droplet className="w-8 h-8" />
                SpO2 + Battito
              </button>

              <button
                onClick={() => startMeasurement('Pressione')}
                disabled={isMeasuring}
                className="w-full py-6 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl font-bold text-2xl shadow-xl hover:shadow-purple-500/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Activity className="w-8 h-8" />
                Pressione
              </button>

              <button
                onClick={() => startMeasurement('Temperatura')}
                disabled={isMeasuring}
                className="w-full py-6 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl font-bold text-2xl shadow-xl hover:shadow-orange-500/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Thermometer className="w-8 h-8" />
                Temperatura
              </button>
            </div>

            {/* Measuring Indicator con Barra Progresso */}
            {isMeasuring && (
              <div className="mb-6 bg-yellow-500 backdrop-blur-xl rounded-2xl p-6 border-4 border-white shadow-2xl">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Zap className="w-8 h-8 text-white animate-bounce" />
                  <p className="text-white font-bold text-2xl">
                    Misurazione in corso...
                  </p>
                </div>

                {/* Barra progresso SpO2 */}
                {spo2Progress > 0 && (
                  <div className="mt-4">
                    <div className="w-full h-4 bg-white/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-100 ${
                          spo2Progress >= 100 ? 'bg-green-500' : 'bg-white'
                        }`}
                        style={{ width: `${spo2Progress}%` }}
                      />
                    </div>
                    <p className={`text-center mt-3 text-lg font-bold ${
                      spo2Progress >= 100 ? 'text-green-900' : 'text-white'
                    }`}>
                      {spo2Progress < 100
                        ? `⏱️ Mantieni fermo il dito: ${Math.ceil(MEASUREMENT_DURATION - (spo2Progress / 100 * MEASUREMENT_DURATION))}s`
                        : '✅ Misurazione completata!'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Results - Mostra sempre dopo misurazione */}
            <div className="space-y-4">
              {/* SpO2 + HR */}
              {(measurements.spo2 !== 0 || measurements.heartRate !== 0) && (
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border-4 border-white/20 shadow-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/70 text-lg mb-1">Ossigeno</p>
                      <p className="text-white text-5xl font-bold">{measurements.spo2 || '--'}%</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-lg mb-1">Battito</p>
                      <p className="text-white text-5xl font-bold">{measurements.heartRate || '--'}</p>
                      <p className="text-white/70 text-sm">BPM</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Blood Pressure */}
              {(measurements.systolic !== 0 || measurements.diastolic !== 0) && (
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border-4 border-white/20 shadow-2xl">
                  <p className="text-white/70 text-lg mb-2">Pressione Sanguigna</p>
                  <p className="text-white text-6xl font-bold">
                    {measurements.systolic || '--'}/{measurements.diastolic || '--'}
                  </p>
                  <p className="text-white/70 text-lg mt-1">mmHg</p>
                </div>
              )}

              {/* Temperature */}
              {measurements.temperature !== 0 && (
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border-4 border-white/20 shadow-2xl">
                  <p className="text-white/70 text-lg mb-2">Temperatura Corporea</p>
                  <p className="text-white text-6xl font-bold">{measurements.temperature}°</p>
                  <p className="text-white/70 text-lg mt-1">Celsius</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.push('/utente/home')}
          className="mt-8 w-full py-5 bg-white/20 backdrop-blur-lg text-white rounded-2xl font-bold text-2xl shadow-lg hover:bg-white/30 transition-all"
        >
          Torna alla Home
        </button>
      </div>
    </div>
  )
}
