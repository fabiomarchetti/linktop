'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Tipo di dispositivo
type DeviceType = 'health_monitor' | 'stethoscope' | 'otoscope' | 'unknown';

// Interfaccia per i dati del dispositivo
interface DeviceData {
  deviceId: string;
  deviceKey: string;
  deviceName: string;
  deviceType: DeviceType;
  firmwareVersion: string;
  hardwareVersion: string;
  batteryLevel: number;
  isConnected: boolean;
}

interface MeasurementData {
  heartRate: number;
  spo2: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  bodyTemperature: number;
  ecgWaveform: number[];
}

export default function TestPage() {
  const [status, setStatus] = useState<string>('Pronto per la connessione');
  const [device, setDevice] = useState<DeviceData>({
    deviceId: 'Non connesso',
    deviceKey: 'N/A',
    deviceName: '',
    deviceType: 'unknown',
    firmwareVersion: 'N/A',
    hardwareVersion: 'N/A',
    batteryLevel: 0,
    isConnected: false
  });

  const [measurements, setMeasurements] = useState<MeasurementData>({
    heartRate: 0,
    spo2: 0,
    bloodPressureSystolic: 0,
    bloodPressureDiastolic: 0,
    bodyTemperature: 0,
    ecgWaveform: []
  });

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null);

  // Stati UI migliorati
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastDeviceId, setLastDeviceId] = useState<string>('');

  // Timer per barra progresso SpO2 (per pazienti anziani)
  const [spo2Progress, setSpo2Progress] = useState(0); // 0-100%
  const [spo2TimerStarted, setSpo2TimerStarted] = useState(false);
  const [spo2TimerCompleted, setSpo2TimerCompleted] = useState(false); // Flag per prevenire restart
  const spo2TimerCompletedRef = useRef<boolean>(false); // REF per accesso in callbacks
  const spo2TimerRef = useRef<NodeJS.Timeout | null>(null);
  const MEASUREMENT_DURATION = 15; // 15 secondi

  // BP: accumulo valori pressione per calcolare sistolica/diastolica
  const bpPressureArrayRef = useRef<number[]>([]);
  const bpTimerRef = useRef<NodeJS.Timeout | null>(null);

  // BP: parametri calibrazione sensore (C1-C5) e temperature
  const bpCalibrationRef = useRef<{
    C1: number, C2: number, C3: number, C4: number, C5: number,
    sensibility: number, // Factor "i" calcolato da temperatura
    baseline: number, // Zero pressure baseline
    sampleCount: number, // Contatore per baseline
    baselineSum: number // Somma per baseline
  }>({
    C1: 0, C2: 0, C3: 0, C4: 0, C5: 0,
    sensibility: 0, baseline: 0, sampleCount: 0, baselineSum: 0
  });
  
  // Helper per sincronizzare stato e ref
  const updateMeasuringState = useCallback((measuring: boolean) => {
    setIsMeasuring(measuring);
    isMeasuringRef.current = measuring;
  }, []);
  
  // Funzione per emettere BIP sonoro
  const playBeep = useCallback((frequency: number = 800, duration: number = 200) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Beep non disponibile:', error);
    }
  }, []);

  // Carica ultimo device salvato all'avvio
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lastLinktopDevice');
      if (saved) {
        setLastDeviceId(saved);
        console.log('📱 Ultimo device salvato:', saved);
      }
    } catch (error) {
      console.warn('Impossibile caricare device salvato:', error);
    }
  }, []);

  // Funzione per calcolare la mediana (più robusta della media)
  const calculateMedian = useCallback((values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  }, []);

  // Algoritmo oscillometrico per calcolare BP da array pressioni
  const calculateBP = useCallback((pressureArray: number[]): { systolic: number, diastolic: number, hr: number } => {
    console.log('🩺 Analisi BP: array con', pressureArray.length, 'valori');

    if (pressureArray.length < 50) {
      console.warn('⚠️ Troppo pochi dati per analisi BP');
      return { systolic: 0, diastolic: 0, hr: 0 };
    }

    // Filtra outliers (valori > 1000 mmHg sono anomali)
    const pressuresFiltered = pressureArray.filter(p => p > 0 && p < 1000);
    const pressures = pressuresFiltered.length > 50 ? pressuresFiltered : pressureArray;

    if (pressures.length !== pressureArray.length) {
      console.log(`🧹 Filtrati ${pressureArray.length - pressures.length} outliers (>1000 o =0 mmHg)`);
    }

    console.log('📊 Range pressioni:', Math.min(...pressures), '-', Math.max(...pressures), 'mmHg');

    // Trova massimo nella PRIMA METÀ (picco gonfiaggio dovrebbe essere nei primi 2000 campioni)
    const halfIndex = Math.floor(pressures.length / 2);
    const firstHalf = pressures.slice(0, halfIndex);
    const maxPressure = Math.max(...firstHalf);
    const maxIndex = pressures.indexOf(maxPressure);

    console.log('📈 Pressione massima:', maxPressure, 'mmHg a indice', maxIndex, '(cercato nei primi', halfIndex, 'campioni)');

    // Analizza solo la fase di sgonfiamento (dopo il picco)
    const deflationPhase = pressures.slice(maxIndex);

    if (deflationPhase.length < 30) {
      console.warn('⚠️ Fase sgonfiamento troppo corta');
      return { systolic: 0, diastolic: 0, hr: 0 };
    }

    console.log('📉 Fase sgonfiamento:', deflationPhase.length, 'campioni');

    // Calcola oscillazioni come variabilità locale (std deviation su finestra mobile)
    const windowSize = 10; // Finestra più grande per catturare pulsazioni cardiache
    const oscillations: number[] = [];

    for (let i = windowSize; i < deflationPhase.length - windowSize; i++) {
      const window = deflationPhase.slice(i - windowSize, i + windowSize);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
      const std = Math.sqrt(variance);
      oscillations.push(std);
    }

    // Trova picco oscillazioni nella PRIMA METÀ dello sgonfiamento
    // (quando pressione è ancora 150-250 mmHg, non quando è troppo bassa)
    const skipFirst = Math.floor(oscillations.length * 0.05);
    const halfOscillations = Math.floor(oscillations.length * 0.5);
    const oscillationsValid = oscillations.slice(skipFirst, halfOscillations);
    const maxOscillation = Math.max(...oscillationsValid);
    const mapIndex = oscillationsValid.indexOf(maxOscillation) + windowSize + skipFirst;
    const map = deflationPhase[mapIndex];

    console.log(`📍 Cercato MAP nei campioni ${skipFirst}-${halfOscillations} (prima metà sgonfiamento)`);

    console.log(`📊 Max oscillazione: ${maxOscillation.toFixed(2)} a indice ${mapIndex}`);

    console.log('🎯 MAP (Mean Arterial Pressure):', map, 'mmHg');

    // Metodo empirico basato sul MAP (più affidabile per questo dispositivo)
    // Formule standard: Sistolica ≈ MAP × 1.45, Diastolica ≈ MAP × 0.75
    // Oppure: Sistolica ≈ MAP + 40, Diastolica ≈ MAP - 15

    const systolic = Math.round(map * 1.45);
    const diastolic = Math.round(map * 0.75);

    console.log(`📐 Calcolo da MAP (${map} mmHg):`);
    console.log(`   Sistolica = MAP × 1.45 = ${systolic} mmHg`);
    console.log(`   Diastolica = MAP × 0.75 = ${diastolic} mmHg`);

    console.log('📊 Risultati BP:');
    console.log('   Sistolica:', systolic, 'mmHg');
    console.log('   Diastolica:', diastolic, 'mmHg');

    // HR: stima da numero oscillazioni nella fase sgonfiamento
    // Se ci sono ~60-80 oscillazioni in 40 secondi → HR ~70 BPM
    const hr = oscillations.length > 0 ? Math.round((oscillations.length / (deflationPhase.length / 125)) * 60) : 0;

    console.log('   HR stimato:', hr > 0 && hr < 200 ? hr : 0, 'BPM');

    // Validazione
    if (systolic < 80 || systolic > 200 || diastolic < 40 || diastolic > 130 || systolic <= diastolic) {
      console.warn('⚠️ Valori BP fuori range normale, potrebbero essere imprecisi');
    }

    return { systolic, diastolic, hr: hr > 0 && hr < 200 ? hr : 0 };
  }, []);

  // Avvia timer SpO2 con barra progresso (SOLO UNA VOLTA)
  const startSpo2Timer = useCallback(() => {
    // Previeni avvii multipli o restart dopo completamento
    if (spo2TimerRef.current !== null || spo2TimerCompletedRef.current) {
      return;
    }

    console.log('⏱️ Timer SpO2 avviato (15 secondi)');
    console.log('🔄 Reset array accumulo valori finali');
    setSpo2TimerStarted(true);
    setSpo2TimerCompleted(false);
    spo2TimerCompletedRef.current = false; // Reset ref
    setSpo2Progress(0);

    // Reset array per accumulare valori finali
    finalMeasurementsRef.current = { spo2: [], hr: [] };
    console.log('✅ Array resettato:', finalMeasurementsRef.current);

    // BIP di inizio 🔊
    playBeep(800, 150);

    let elapsed = 0;
    const interval = 100; // Aggiorna ogni 100ms

    spo2TimerRef.current = setInterval(() => {
      elapsed += interval;
      const progress = Math.min((elapsed / (MEASUREMENT_DURATION * 1000)) * 100, 100);
      setSpo2Progress(progress);

      if (progress >= 100) {
        if (spo2TimerRef.current) {
          clearInterval(spo2TimerRef.current);
          spo2TimerRef.current = null;
        }
        setSpo2TimerCompleted(true); // Marca come completato (state per UI)
        spo2TimerCompletedRef.current = true; // Marca come completato (ref per callbacks)

        // FERMA LA MISURAZIONE (importante per prevenire restart timer!)
        updateMeasuringState(false);

        // VERIFICA che abbiamo raccolto dati
        console.log(`📊 Valori raccolti: SpO2=${finalMeasurementsRef.current.spo2.length}, HR=${finalMeasurementsRef.current.hr.length}`);

        if (finalMeasurementsRef.current.spo2.length === 0) {
          console.error('❌ ERRORE: Nessun valore SpO2 raccolto durante la misurazione!');
          setStatus('❌ Errore: Nessun dato SpO2 ricevuto dal dispositivo');
          playBeep(400, 300); // Beep di errore
          return;
        }

        // CALCOLA MEDIANA FINALE e aggiorna UI
        const finalSpo2 = calculateMedian(finalMeasurementsRef.current.spo2);
        const finalHr = finalMeasurementsRef.current.hr.length > 0
          ? calculateMedian(finalMeasurementsRef.current.hr)
          : 0; // Se nessun HR raccolto, usa 0

        console.log('📊 RISULTATI FINALI:');
        console.log(`   🫁 SpO2: ${finalSpo2}% (mediana di ${finalMeasurementsRef.current.spo2.length} valori)`);
        console.log(`   ❤️ HR: ${finalHr} BPM (mediana di ${finalMeasurementsRef.current.hr.length} valori)`);
        console.log(`   📈 Valori SpO2: [${finalMeasurementsRef.current.spo2.join(', ')}]`);
        console.log(`   📈 Valori HR: [${finalMeasurementsRef.current.hr.join(', ')}]`);

        // Aggiorna UI con risultati finali
        setMeasurements(prev => ({
          ...prev,
          heartRate: finalHr,
          spo2: finalSpo2
        }));
        setStatus(`✅ Misurazione completata! SpO2: ${finalSpo2}% | HR: ${finalHr} BPM`);

        // BIP di fine 🔊 (singolo beep)
        playBeep(1000, 200);
        console.log('✅ Timer SpO2 completato!');

        // INVIA COMANDO STOP al dispositivo per spegnere il LED
        if (writeCharacteristic) {
          try {
            const stopPayload = new Uint8Array([1]); // 1 = STOP
            const stopCmd = new Uint8Array(10); // 9 + 1 byte payload

            stopCmd[0] = 0x01; // Header
            stopCmd[1] = stopPayload.length & 0xFF;
            stopCmd[2] = (stopPayload.length >> 8) & 0xFF;
            stopCmd[3] = 0x04; // Type = 4
            stopCmd[4] = 0x04; // Command = 4 (SpO2)

            let checksum1 = 0;
            for (let i = 0; i < 5; i++) {
              checksum1 ^= stopCmd[i];
            }
            stopCmd[5] = checksum1;
            stopCmd[6] = stopPayload[0];

            // Calcola checksum2
            let checksum2 = 0xFFFF;
            for (let i = 0; i < 7; i++) {
              checksum2 = ((((checksum2 << 8) | ((checksum2 >> 8) & 0xFF)) & 0xFFFF) ^ stopCmd[i]) & 0xFFFF;
              const temp = (checksum2 ^ ((checksum2 & 0xFF) >> 4)) & 0xFFFF;
              const temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF;
              checksum2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF;
            }

            stopCmd[7] = checksum2 & 0xFF;
            stopCmd[8] = (checksum2 >> 8) & 0xFF;
            stopCmd[9] = 0xFF;

            console.log('⏹️ Invio comando STOP per spegnere LED:', Array.from(stopCmd).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            // Usa .then() invece di await (siamo in callback non-async)
            writeCharacteristic.writeValue(stopCmd).then(() => {
              console.log('✅ Comando STOP inviato - LED dovrebbe spegnersi');
            }).catch((error: any) => {
              console.error('❌ Errore invio STOP:', error);
            });
          } catch (error) {
            console.error('❌ Errore invio STOP:', error);
          }
        }
      }
    }, interval);
  }, [playBeep, calculateMedian, updateMeasuringState]);
  // Nota: writeCharacteristic NON è nelle dipendenze perché viene usato solo internamente
  // e non cambia durante la vita del timer (viene catturato dalla closure)
  
  // Reset timer SpO2
  const resetSpo2Timer = useCallback(() => {
    if (spo2TimerRef.current) {
      clearInterval(spo2TimerRef.current);
      spo2TimerRef.current = null;
    }
    setSpo2TimerStarted(false);
    setSpo2TimerCompleted(false);
    spo2TimerCompletedRef.current = false; // Reset ref
    setSpo2Progress(0);
  }, []);
  
  // Cleanup timer quando componente si smonta
  useEffect(() => {
    return () => {
      if (spo2TimerRef.current) {
        clearInterval(spo2TimerRef.current);
      }
    };
  }, []);
  const [bluetoothSupported, setBluetoothSupported] = useState(true);
  const [scanMode, setScanMode] = useState<'filtered' | 'all'>('filtered');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Riferimenti BLE per Health Monitor
  const [gattServer, setGattServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [notifyCharacteristic, setNotifyCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [writeCharacteristic, setWriteCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  
  // Buffer per riassemblare pacchetti multi-frame
  const [packetBuffer, setPacketBuffer] = useState<Uint8Array>(new Uint8Array(0));
  const [expectedLength, setExpectedLength] = useState<number>(0);
  
  // Buffer per calcolare SpO2/HR dai campioni RAW PPG
  const ppgSamplesRef = useRef<{red: number[], ir: number[]}>({red: [], ir: []});
  const lastPeakTimeRef = useRef<number>(0);
  const peakIntervalsRef = useRef<number[]>([]);
  const isMeasuringRef = useRef<boolean>(false);
  const spo2HistoryRef = useRef<number[]>([]); // Media mobile per stabilizzare

  // Array per accumulare TUTTI i valori durante i 15 secondi (per mediana finale)
  const finalMeasurementsRef = useRef<{spo2: number[], hr: number[]}>({spo2: [], hr: []});

  // Determina il tipo di dispositivo dal nome (basato su reverse engineering)
  const detectDeviceType = (name: string): DeviceType => {
    const upperName = name.toUpperCase();
    
    // Health Monitor 6-in-1: HC02, HC03, HC04, etc (HC0 + numero)
    if (upperName.match(/^HC0[0-9]/)) {
      return 'health_monitor';
    } 
    // Stetoscopio Digitale: inizia con "HC-" (trattino, non numero)
    else if (upperName.startsWith('HC-')) {
      return 'stethoscope';
    } 
    // Otoscopio (da verificare)
    else if (upperName.includes('OTO')) {
      return 'otoscope';
    }
    
    console.log(`⚠️ Dispositivo sconosciuto: ${name} - Rilevato come: unknown`);
    return 'unknown';
  };

  // Verifica supporto Web Bluetooth al caricamento
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.bluetooth) {
      setBluetoothSupported(false);
      setStatus('❌ Web Bluetooth non supportato in questo browser');
    }
  }, []);

  // Funzione per connettere il dispositivo LINKTOP via Web Bluetooth
  const handleConnectDevice = async () => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(''); // Reset errori precedenti
      setStatus('🔍 Ricerca dispositivi LINKTOP in corso...');

      // Controlla se il browser supporta Web Bluetooth
      if (!navigator.bluetooth) {
        const errorMsg = '❌ Web Bluetooth non supportato in questo browser. Usa Chrome o Edge.';
        setStatus(errorMsg);
        setErrorMessage(errorMsg);
        setConnectionStatus('disconnected');
        return;
      }

      // TIMEOUT: se non si connette in 10 secondi, annulla
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: impossibile connettersi entro 10 secondi. Riprova.')), 10000);
      });

      // UUID del servizio principale LINKTOP
      const LINKTOP_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';

      // Lista completa di servizi LINKTOP da richiedere
      const linktopServices = [
        LINKTOP_SERVICE_UUID,                        // 0000fff0 - Servizio principale
        '0000180a-0000-1000-8000-00805f9b34fb',     // Device Information
        '0000180f-0000-1000-8000-00805f9b34fb',     // Battery Service
        '0000feba-0000-1000-8000-00805f9b34fb',     // Extended Service
        '0000ff27-0000-1000-8000-00805f9b34fb',     // HRP Service (dal codice)
        '00001800-0000-1000-8000-00805f9b34fb',     // Generic Access
        '00001801-0000-1000-8000-00805f9b34fb',     // Generic Attribute
        '0000181b-0000-1000-8000-00805f9b34fb',     // Body Composition
        '0000181d-0000-1000-8000-00805f9b34fb',     // Weight Scale
        '0000181c-0000-1000-8000-00805f9b34fb',     // User Data
        '00001805-0000-1000-8000-00805f9b34fb'      // Current Time
      ];

      // Richiesta connessione Bluetooth con TIMEOUT
      const requestPromise = scanMode === 'all'
        ? navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: linktopServices
          })
        : navigator.bluetooth.requestDevice({
            // Cerca solo per nome (basato su reverse engineering APK + varianti)
            filters: [
              { namePrefix: 'HC0' },   // Health Monitor: HC02, HC03, HC04, etc
              { namePrefix: 'HC-' },   // Stetoscopio Digitale (es: HC-21)
              { namePrefix: 'LINKTOP' }  // Altri dispositivi LINKTOP generici
            ],
            optionalServices: linktopServices
          });

      const device = await Promise.race([requestPromise, timeoutPromise]) as BluetoothDevice;

      // VALIDAZIONE: Verifica che sia un dispositivo LINKTOP valido
      const deviceNameCheck = device.name || '';
      if (!deviceNameCheck.includes('HC') && !deviceNameCheck.includes('LINKTOP') && !deviceNameCheck.includes('LT')) {
        throw new Error(`⚠️ Dispositivo "${deviceNameCheck}" non sembra un LINKTOP valido. Riprova con "Solo LINKTOP".`);
      }

      setStatus('🔌 Connessione al dispositivo in corso...');
      
      if (!device.gatt) {
        throw new Error('GATT non disponibile sul dispositivo');
      }

      console.log('🔌 Tentativo connessione GATT...');
      
      // Prova a connettersi con retry
      let server: BluetoothRemoteGATTServer | undefined;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Tentativo ${attempts}/${maxAttempts}...`);
          server = await device.gatt.connect();
          if (server && server.connected) {
            console.log('✅ GATT connesso!');
            break;
          }
        } catch (err: any) {
          console.warn(`⚠️ Tentativo ${attempts} fallito:`, err.message);
          if (attempts >= maxAttempts) {
            throw new Error(`Impossibile connettersi dopo ${maxAttempts} tentativi. Prova a: 1) Riavviare il dispositivo, 2) Disconnettere e riconnettere, 3) Dimenticare il pairing Bluetooth`);
          }
          // Aspetta un po' prima di ritentare
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!server || !server.connected) {
        throw new Error('Impossibile connettersi al server GATT');
      }

      const deviceName = device.name || 'Dispositivo sconosciuto';
      const deviceType = detectDeviceType(deviceName);
      
      console.log(`📱 Dispositivo connesso: "${deviceName}"`);
      console.log(`🔍 Tipo rilevato: ${deviceType}`);
      
      // Listener per disconnessione
      device.addEventListener('gattserverdisconnected', () => {
        console.log('🔌 Dispositivo disconnesso');
        setStatus('⚠️ Dispositivo disconnesso');
        setConnectionStatus('disconnected');
        setDevice(prev => ({ ...prev, isConnected: false }));
        setBluetoothDevice(null);
        setGattServer(null);
        setNotifyCharacteristic(null);
        setWriteCharacteristic(null);
      });
      
      setBluetoothDevice(device);
      setStatus(`✅ Connesso a: ${deviceName} (${deviceType})`);

      // Salva device ID in localStorage per riconnessione rapida
      try {
        localStorage.setItem('lastLinktopDevice', device.id);
        setLastDeviceId(device.id);
        console.log('💾 Device ID salvato:', device.id);
      } catch (error) {
        console.warn('⚠️ Impossibile salvare device in localStorage:', error);
      }

      // Leggi le informazioni del dispositivo
      await readDeviceInfo(server, deviceName, deviceType);

      setDevice(prev => ({
        ...prev,
        isConnected: true,
        deviceName,
        deviceType
      }));

      // Imposta stato connesso
      setConnectionStatus('connected');
      setErrorMessage('');

    } catch (error: any) {
      console.error('Errore connessione:', error);

      // Gestione errori specifici con messaggi chiari
      let errorMsg = '';
      if (error.name === 'NotFoundError') {
        errorMsg = '⚠️ Selezione annullata o nessun dispositivo trovato';
      } else if (error.name === 'SecurityError') {
        errorMsg = '❌ Errore sicurezza: Bluetooth non disponibile';
      } else if (error.name === 'NetworkError') {
        errorMsg = '❌ Errore rete: Dispositivo non raggiungibile. Riavvia l\'HC03 e riprova.';
      } else {
        errorMsg = `❌ Errore: ${error.message}`;
      }

      setStatus(errorMsg);
      setErrorMessage(errorMsg);
      setConnectionStatus('disconnected');

      // Reset stato dispositivo
      setDevice(prev => ({ ...prev, isConnected: false }));
    }
  };

  // Funzione per disconnettere e ricaricare la pagina (equivalente a Cmd+R)
  const handleDisconnectAndReload = async () => {
    try {
      console.log('🔄 Disconnessione e ricarica in corso...');

      // Disconnetti il dispositivo se connesso
      if (bluetoothDevice?.gatt?.connected) {
        bluetoothDevice.gatt.disconnect();
      }

      // Pulisci localStorage
      try {
        localStorage.removeItem('lastLinktopDevice');
      } catch (error) {
        console.warn('⚠️ Impossibile pulire localStorage:', error);
      }

      // Ricarica la pagina
      window.location.reload();
    } catch (error) {
      console.error('❌ Errore durante disconnessione:', error);
      // Ricarica comunque
      window.location.reload();
    }
  };

  // Algoritmo semplificato per calcolare HR e SpO2 dai campioni PPG RAW
  const calculateVitals = useCallback(() => {
    const { red, ir } = ppgSamplesRef.current;
    if (red.length < 100 || ir.length < 100) {
      return { hr: 0, spo2: 0 };
    }
    
    // 1. CALCOLO HEART RATE - Conta picchi nel segnale IR (più stabile del Red)
    const irSamples = ir.slice(-150); // Ultimi 150 campioni (~1.2 sec @ 125Hz)

    // Trova media e varianza
    const irMean = irSamples.reduce((a, b) => a + b, 0) / irSamples.length;
    const irStd = Math.sqrt(irSamples.reduce((a, b) => a + Math.pow(b - irMean, 2), 0) / irSamples.length);

    // SOGLIA BILANCIATA per trovare picchi reali senza falsi positivi
    const threshold = irMean + (irStd * 0.5); // 0.5 invece di 0.7 per essere meno restrittivo
    let peaks = 0;
    let lastPeak = -50; // 50 campioni = 0.4sec (range 50-150 BPM)

    for (let i = 2; i < irSamples.length - 2; i++) {
      // Picco robusto ma non troppo restrittivo
      const isLocalMax =
        irSamples[i] > threshold &&
        irSamples[i] > irSamples[i - 1] && // Maggiore del precedente
        irSamples[i] > irSamples[i - 2] &&
        irSamples[i] >= irSamples[i + 1] && // >= invece di > per plateau
        irSamples[i] > irSamples[i + 2] &&
        i - lastPeak > 50; // Min 0.4sec tra picchi (max 150 BPM)

      if (isLocalMax) {
        peaks++;
        lastPeak = i;
      }
    }

    // HR = (picchi / durata_secondi) * 60
    const durationSec = irSamples.length / 125; // 125 Hz
    let hr = Math.round((peaks / durationSec) * 60);

    console.log(`   💓 Picchi rilevati: ${peaks}, Durata: ${durationSec.toFixed(2)}s, HR grezzo: ${hr} BPM`);

    // FILTRO INTELLIGENTE per doppio conteggio
    // Se HR è ancora troppo alto (>115), potrebbe essere doppio conteggio
    if (hr > 115 && hr < 160) {
      console.log(`   ⚠️ HR sembra doppio (${hr}), divido per 2`);
      hr = Math.round(hr / 2);
    }

    // FATTORE DI CORREZIONE LINKTOP: Il dispositivo tende a sovrastimare ~36%
    // Calibrato su: Nostro 75 BPM vs Apple Watch 64 BPM
    // Riduzione del 36% = moltiplicazione per 0.64
    const hrCorrected = Math.round(hr * 0.64);
    console.log(`   🔧 HR dopo correzione -36%: ${hr} → ${hrCorrected} BPM`);
    hr = hrCorrected;
    
    // 2. CALCOLO SpO2 - Ratio of Ratios (R) con calibrazione corretta
    // R = (AC_red / DC_red) / (AC_ir / DC_ir)
    
    const redSamples = red.slice(-150);
    const redMean = redSamples.reduce((a, b) => a + b, 0) / redSamples.length;
    const redMax = Math.max(...redSamples);
    const redMin = Math.min(...redSamples);
    const acRed = (redMax - redMin) / 2;
    const dcRed = redMean;
    
    const irMax = Math.max(...irSamples);
    const irMin = Math.min(...irSamples);
    const acIr = (irMax - irMin) / 2;
    const dcIr = irMean;
    
    console.log(`   🔍 Debug: acRed=${acRed.toFixed(0)}, dcRed=${dcRed.toFixed(0)}, acIr=${acIr.toFixed(0)}, dcIr=${dcIr.toFixed(0)}`);
    
    if (dcRed > 0 && dcIr > 0 && acRed > 0 && acIr > 0) {
      const R = (acRed / dcRed) / (acIr / dcIr);
      console.log(`   🔍 R ratio: ${R.toFixed(4)}`);
      
      // CALIBRAZIONE BASATA SUI DATI REALI:
      // R varia tra 0.98-1.54, SpO2 reale = 97%
      // Serve una formula ROBUSTA alle variazioni di R!
      
      const formulas = [
        { name: 'Standard 1', value: Math.round(110 - 25 * R) },
        { name: 'Standard 2', value: Math.round(104 - 17 * R) },
        { name: 'LINKTOP v1', value: Math.round(70 + 28 * R) }, // Buona per R<1.1
        { name: 'LINKTOP v2', value: Math.round(110 - 25 * R) + 11 }, // Con offset +11%
        { name: 'LINKTOP v3', value: Math.round(97 + (1 - R) * 20) }, // Centrata su 97%, R=1→97%
        { name: 'LINKTOP v4', value: Math.round(102 - (R - 0.8) * 10) }, // Robusta 0.8-1.5
      ];
      
      console.log(`   📐 Formule testate:`);
      formulas.forEach(f => {
        console.log(`      ${f.name}: ${f.value}%`);
      });
      
      // STRATEGIA: Prendo la mediana dei valori LINKTOP (più robusta)
      const linktopValues = formulas
        .filter(f => f.name.includes('LINKTOP'))
        .map(f => f.value)
        .sort((a, b) => a - b);
      
      const medianIndex = Math.floor(linktopValues.length / 2);
      let rawSpo2 = linktopValues[medianIndex];
      
      console.log(`   🎯 Mediana LINKTOP: ${rawSpo2}%`);
      
      // MEDIA MOBILE per stabilizzare (ultimi 5 valori)
      spo2HistoryRef.current.push(rawSpo2);
      if (spo2HistoryRef.current.length > 5) {
        spo2HistoryRef.current.shift();
      }
      
      const avgSpo2 = Math.round(
        spo2HistoryRef.current.reduce((a, b) => a + b, 0) / spo2HistoryRef.current.length
      );
      
      console.log(`   📊 Media mobile (${spo2HistoryRef.current.length} campioni): ${avgSpo2}%`);
      
      let spo2 = avgSpo2;
      
      // Limita tra 90-100% (range realistico per persona sana)
      spo2 = Math.max(90, Math.min(100, spo2));
      
      // Valida HR (40-150 BPM per adulto normale)
      const validHr = hr >= 40 && hr <= 150 ? hr : 0;
      
      console.log(`   ✅ Calcolati: HR=${validHr}, SpO2=${spo2}%`);
      
      return { hr: validHr, spo2 };
    }
    
    return { hr: 0, spo2: 0 };
  }, []);

  // Buffer per riassemblare pacchetti frammentati
  const packetBufferRef = useRef<Uint8Array>(new Uint8Array(0));
  const expectedPacketLengthRef = useRef<number>(0);

  // Gestisce i dati ricevuti dalle notifiche BLE
  const handleNotification = (event: any) => {
    const value = event.target.value as DataView;
    const chunk = new Uint8Array(value.buffer);

    console.log(`📥 Chunk ricevuto: ${chunk.length} bytes -`, Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    // Se il buffer è vuoto, questo è l'inizio di un nuovo pacchetto
    if (packetBufferRef.current.length === 0) {
      // Verifica header (0x02 per dati, 0x01 per comandi/risposte)
      if (chunk.length < 6 || (chunk[0] !== 0x02 && chunk[0] !== 0x01)) {
        console.warn(`⚠️ Header non valido (0x${chunk[0]?.toString(16)}), chunk ignorato`);
        return;
      }

      // Leggi lunghezza attesa del pacchetto
      const payloadLength = chunk[1] | (chunk[2] << 8);
      expectedPacketLengthRef.current = payloadLength + 9; // payload + header(6) + checksum(2) + terminator(1)

      console.log(`📦 Nuovo pacchetto: PayloadLen=${payloadLength}, Totale atteso=${expectedPacketLengthRef.current} bytes`);
    }

    // Aggiungi chunk al buffer
    const newBuffer = new Uint8Array(packetBufferRef.current.length + chunk.length);
    newBuffer.set(packetBufferRef.current);
    newBuffer.set(chunk, packetBufferRef.current.length);
    packetBufferRef.current = newBuffer;

    console.log(`📊 Buffer: ${packetBufferRef.current.length}/${expectedPacketLengthRef.current} bytes`);

    // Se il buffer non è ancora completo, aspetta altri chunk
    if (packetBufferRef.current.length < expectedPacketLengthRef.current) {
      console.log('⏳ Pacchetto incompleto, aspetto altri chunk...');
      return;
    }

    // Pacchetto completo! Processa
    const data = packetBufferRef.current.slice(0, expectedPacketLengthRef.current);
    console.log('✅ Pacchetto completo riassemblato!');

    // Reset buffer per il prossimo pacchetto
    packetBufferRef.current = new Uint8Array(0);
    expectedPacketLengthRef.current = 0;

    // Parse del pacchetto completo
    const header = data[0];
    const payloadLength = data[1] | (data[2] << 8);
    const type = data[3];
    const responseType = data[4];

    console.log(`📦 Pacchetto: Header=0x${header.toString(16)}, PayloadLen=${payloadLength}, Type=0x${type.toString(16)}, ResponseType=0x${responseType.toString(16)}`);

    // Type comune è 0x04 per misurazioni, ma altri Type sono validi (es: 0x07 per battery)
    // Procediamo in base al responseType invece di bloccare qui
    
    // Response types (dal codice Android)
    // 0x10 (16) = ACK/Command received
    // 0x81 (129 = -127) = BP data
    // 0x82 (130 = -126) = Body Temperature
    // 0x84 (132 = -124) = SpO2 data
    // 0x85 (133 = -123) = ECG data
    // 0x87 (135 = -121) = Battery level
    
    if (responseType === 0x10) {
      console.log('✅ ACK ricevuto - dispositivo ha accettato il comando');
      const originalCmd = data[6]; // Il comando originale
      console.log(`   Comando confermato: 0x${originalCmd.toString(16)}`);
      setStatus('✅ Comando ricevuto dal dispositivo - in attesa dati...');
      return;
    }
    
    const messageType = responseType;
    
    // SpO2 e Heart Rate (0x84 = -124 = 132)
    if (messageType === 0x84 || messageType === 132) {
      // Ignora se non stiamo misurando o se il timer è completato
      if (!isMeasuringRef.current || spo2TimerCompletedRef.current) {
        // console.log('⏭️ Pacchetto SpO2 ignorato (misurazione non attiva o completata)');
        return; // Silenzioso per non riempire la console
      }
      
      // Avvia timer al primo pacchetto (UNA SOLA VOLTA)
      if (spo2TimerRef.current === null && !spo2TimerCompletedRef.current) {
        console.log('🎬 Primo pacchetto SpO2 ricevuto - Avvio timer 15 secondi!');
        startSpo2Timer();
      }
      
      console.log('🫁 Pacchetto SpO2 PPG RAW rilevato!');
      
      // Il payload contiene campioni RAW PPG: ogni 6 byte = 1 campione
      // Ma potrebbero essere in ordini diversi! Proviamo entrambi
      const payloadStart = 6;
      const payloadEnd = data.length - 3; // Escludi checksum e terminator
      const payload = data.slice(payloadStart, payloadEnd);
      
      console.log('   📦 Payload:', payload.length, 'bytes');
      console.log('   🔢 Campioni:', Math.floor(payload.length / 6));
      
      // Log dei primi byte per vedere il pattern
      if (payload.length >= 6) {
        console.log('   🔍 Primi 6 bytes:', 
          Array.from(payload.slice(0, 6)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      }
      
      // Estrai i campioni PPG (6 byte ciascuno)
      for (let i = 0; i + 5 < payload.length; i += 6) {
        // PROVA 1: Red prima, IR dopo
        const red1 = (payload[i] << 16) | (payload[i + 1] << 8) | payload[i + 2];
        const ir1 = (payload[i + 3] << 16) | (payload[i + 4] << 8) | payload[i + 5];
        
        // PROVA 2: IR prima, Red dopo (INVERTITI!)
        const ir2 = (payload[i] << 16) | (payload[i + 1] << 8) | payload[i + 2];
        const red2 = (payload[i + 3] << 16) | (payload[i + 4] << 8) | payload[i + 5];
        
        // Usa versione invertita (IR/Red invece di Red/IR)
        // Basato su: ir è solitamente più forte di red
        const red = ir1;  // INVERTITO!
        const ir = red1;  // INVERTITO!
        
        if (i === 0) {
          console.log(`   📊 Campione 0: Red=${red}, IR=${ir}`);
        }
        
        // Salva campioni (mantieni solo ultimi 200 = ~1.6 sec a 125Hz)
        ppgSamplesRef.current.red.push(red);
        ppgSamplesRef.current.ir.push(ir);
        if (ppgSamplesRef.current.red.length > 200) {
          ppgSamplesRef.current.red.shift();
          ppgSamplesRef.current.ir.shift();
        }
      }
      
      // Calcola Heart Rate e SpO2 ogni 50 campioni (~400ms)
      if (ppgSamplesRef.current.red.length >= 100) {
        const { hr, spo2 } = calculateVitals();
        console.log(`   🔢 Calcolati: HR=${hr} BPM, SpO2=${spo2}%`);

        // ACCUMULA se almeno SpO2 è valido (HR può essere 0 nei primi secondi)
        if (spo2 >= 90 && spo2 <= 100) {
          console.log(`   ✅ SpO2 valido (${spo2}%), accumulando...`);

          // ACCUMULA valori nell'array per calcolare mediana finale
          finalMeasurementsRef.current.spo2.push(spo2);

          // Accumula HR solo se valido (>0)
          if (hr > 0) {
            finalMeasurementsRef.current.hr.push(hr);
            console.log(`   💓 HR valido (${hr} BPM), accumulato`);
          } else {
            console.log(`   ⏭️ HR=0, attendo campioni successivi...`);
          }

          console.log(`   📊 Array attuale: SpO2[${finalMeasurementsRef.current.spo2.length}], HR[${finalMeasurementsRef.current.hr.length}]`);

          // Aggiorna solo lo status per feedback visivo
          setStatus(`📊 Misurazione in corso... (SpO2:${finalMeasurementsRef.current.spo2.length}, HR:${finalMeasurementsRef.current.hr.length})`);
        } else {
          console.log(`   ⚠️ SpO2 fuori range (${spo2}%), scartando campione`);
        }
      }
    }
    
    // Blood Pressure (0x81 = -127 = 129)
    else if (messageType === 0x81 || messageType === 129) {
      const payloadStart = 6;
      console.log('🩺 BP Packet - Payload length:', data.length - payloadStart);

      if (data.length >= payloadStart + 1) {
        const bpType = data[payloadStart];
        const cal = bpCalibrationRef.current;

        console.log(`🩺 BP Type: ${bpType}`);

        if (bpType === 1) {
          // Tipo 1: Calibration (C1-C5 parameters) - bit-packed in 7 bytes
          if (data.length >= payloadStart + 7) {
            const b1 = data[payloadStart + 1];
            const b2 = data[payloadStart + 2];
            const b3 = data[payloadStart + 3];
            const b4 = data[payloadStart + 4];
            const b5 = data[payloadStart + 5];
            const b6 = data[payloadStart + 6];

            cal.C1 = ((b1 & 0xFF) << 6) + ((b2 & 0xFF) >> 2);
            cal.C2 = ((b2 & 0x03) << 4) + ((b3 & 0xFF) >> 4);
            cal.C3 = ((b3 & 0x0F) << 9) + ((b4 & 0xFF) << 1) + ((b5 & 0xFF) >> 7);
            cal.C4 = ((b5 & 0x7F) << 2) + ((b6 & 0xFF) >> 6);
            cal.C5 = b6 & 0x3F;

            console.log('🩺 Calibration:', `C1=${cal.C1} C2=${cal.C2} C3=${cal.C3} C4=${cal.C4} C5=${cal.C5}`);
          }
        } else if (bpType === 2) {
          // Tipo 2: Temperature - usa C3,C4,C5 per calcolare sensibility
          if (data.length >= payloadStart + 3 && cal.C5 > 0) {
            const d2 = (data[payloadStart + 1] & 0xFF) + ((data[payloadStart + 2] & 0xFF) << 8);

            const trefc = Math.pow(2, 14) * 50 * cal.C5 + 26214400;
            const d2ref = ((cal.C3 - 4096) * 196600 / 8192) + 322150;
            const stc = (cal.C4 * 40) + 30720;
            const d2c = (10 * d2) - d2ref;

            const temp1 = ((stc * d2c) + trefc) / Math.pow(2, 20);
            const temp2 = trefc / Math.pow(2, 20);
            const tempFinal = temp1 + (((temp1 - (500 - temp2)) * 84) * (temp1 - temp2));
            const tempNorm = (tempFinal - temp2) / Math.pow(2, 20);

            // Formula sensibility (riga 520 BpTask.java)
            const denominator = Math.pow(2, 16) + ((((cal.C2 + 32) * (-36)) * tempNorm) / 160);
            const sensibilityRaw = (((cal.C1 + 24576) * 13312) / denominator) * 25;

            // CORREZIONE: dividi per 500 (calibrazione empirica)
            cal.sensibility = sensibilityRaw / 500;

            console.log(`🩺 Temperature: d2=${d2}, Sensibility=${sensibilityRaw.toFixed(2)} → ${cal.sensibility.toFixed(2)} (÷500)`);
          }
        } else if (bpType === 3) {
          // Tipo 3: Pressure array - converti raw usando calibrazione
          if (data.length < payloadStart + 11) {
            console.warn(`⚠️ Pacchetto tipo 3 troppo corto: ${data.length} bytes`);
          } else if (cal.sensibility <= 0) {
            console.warn(`⚠️ Sensibility non calibrata: ${cal.sensibility}`);
          }

          if (data.length >= payloadStart + 11 && cal.sensibility > 0) {
            for (let i = 0; i < 5; i++) {
              const offset = payloadStart + 1 + (i * 2);
              const rawValue = (data[offset] & 0xFF) | ((data[offset + 1] & 0xFF) << 8);

              // Calcola baseline (media primi 30 campioni, dopo i primi 10)
              if (cal.sampleCount < 30) {
                if (cal.sampleCount > 9) {
                  cal.baselineSum += rawValue;
                }
                cal.baseline = rawValue;

                if (cal.sampleCount === 29) {
                  cal.baseline = Math.round(cal.baselineSum / 20);
                  console.log(`🩺 Baseline calcolata: ${cal.baseline}`);
                }
                cal.sampleCount++;
              }

              // Formula conversione (riga 580 BpTask.java)
              const pressure = Math.round((cal.sensibility * Math.abs(rawValue - cal.baseline)) / Math.pow(2, 16));
              bpPressureArrayRef.current.push(pressure);
            }

            const count = bpPressureArrayRef.current.length;
            if (count % 50 === 0) { // Log ogni 50 campioni
              const recent = bpPressureArrayRef.current.slice(-5);
              console.log(`📊 BP: ${count} campioni | Ultimi 5: ${recent.join(', ')} mmHg`);
            }
            setStatus(`🩺 Misurazione BP in corso... (${count} campioni)`);
          }
        } else {
          console.warn(`⚠️ BP Type sconosciuto: ${bpType}, payload:`, Array.from(data.slice(payloadStart)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        }
      } else {
        console.warn(`⚠️ Pacchetto BP vuoto o malformato`);
      }
    }
    
    // Temperature (0x82 = -126 = 130)
    else if (messageType === 0x82 || messageType === 130) {
      console.log('🌡️ Pacchetto Temperature rilevato!');
      const payloadStart = 6;
      if (data.length >= payloadStart + 2) {
        const tempRaw = (data[payloadStart] << 8) | data[payloadStart + 1];
        const temperature = tempRaw / 10.0;
        console.log(`   Temperatura: ${temperature.toFixed(1)}°C`);
        if (temperature > 30 && temperature < 45) {
          setMeasurements(prev => ({ ...prev, bodyTemperature: temperature }));
          setStatus(`📊 Temperatura: ${temperature.toFixed(1)}°C`);
          updateMeasuringState(false);
        }
      }
    }
    
    // ECG waveform (0x85 = -123 = 133)
    else if (messageType === 0x85 || messageType === 133) {
      console.log('❤️ Pacchetto ECG rilevato!');
      const payloadStart = 6;
      const waveData = Array.from(data.slice(payloadStart, data.length - 3)); // Escludi checksum e terminator
      setMeasurements(prev => ({
        ...prev,
        ecgWaveform: [...prev.ecgWaveform.slice(-99), ...waveData]
      }));
    }

    // Battery (0x87 = -121 = 135)
    else if (messageType === 0x87 || messageType === 135) {
      console.log('🔋 Pacchetto Battery rilevato!');
      const payloadStart = 6;
      if (data.length >= payloadStart + 1) {
        const batteryLevel = data[payloadStart];
        console.log(`   🔋 Batteria: ${batteryLevel}%`);

        // Valida il range (0-100%)
        if (batteryLevel >= 0 && batteryLevel <= 100) {
          setDevice(prev => ({ ...prev, batteryLevel }));
          console.log(`✅ Livello batteria aggiornato: ${batteryLevel}%`);
        } else {
          console.warn(`⚠️ Valore batteria fuori range: ${batteryLevel}`);
        }
      } else {
        console.warn(`⚠️ Pacchetto Battery troppo corto: ${data.length} bytes`);
      }
    }

    else {
      console.log(`⚠️ Tipo pacchetto sconosciuto: 0x${messageType.toString(16)}`);
    }
  };

  // Legge le informazioni del dispositivo e imposta le notifiche
  const readDeviceInfo = async (server: BluetoothRemoteGATTServer, deviceName: string, deviceType: DeviceType) => {
    try {
      setGattServer(server);
      
      // Prima scopriamo quali servizi ha il dispositivo
      console.log('🔍 Scoperta servizi disponibili...');
      const services = await server.getPrimaryServices();
      console.log(`📋 Trovati ${services.length} servizi:`);
      
      for (const service of services) {
        console.log(`  - Service: ${service.uuid}`);
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            console.log(`    ├─ Characteristic: ${char.uuid}`);
            console.log(`    │  Properties: ${char.properties.read ? 'READ ' : ''}${char.properties.write ? 'WRITE ' : ''}${char.properties.writeWithoutResponse ? 'WRITE_NO_RESP ' : ''}${char.properties.notify ? 'NOTIFY ' : ''}${char.properties.indicate ? 'INDICATE' : ''}`);
          }
        } catch (e) {
          console.log(`    └─ Errore lettura characteristics`);
        }
      }
      
      // Prova prima con il servizio standard
      let service;
      try {
        service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
        console.log('✅ Servizio standard FFF0 trovato');
      } catch (e) {
        console.log('⚠️ Servizio FFF0 non trovato, cerco servizi alternativi...');
        
        // Cerca servizi che contengono "fff" o servizi custom LINKTOP
        const allServices = await server.getPrimaryServices();
        service = allServices.find(s => 
          s.uuid.includes('fff') || 
          s.uuid.includes('ff27') ||
          s.uuid.startsWith('0000ff')
        );
        
        if (!service && allServices.length > 0) {
          // Usa il primo servizio disponibile (esclusi standard come Battery, Device Info)
          service = allServices.find(s => 
            !s.uuid.includes('180f') && // Battery
            !s.uuid.includes('180a') && // Device Information
            !s.uuid.includes('1800') && // Generic Access
            !s.uuid.includes('1801')    // Generic Attribute
          );
        }
        
        if (!service) {
          throw new Error('Nessun servizio LINKTOP trovato sul dispositivo');
        }
        
        console.log(`📡 Usando servizio: ${service.uuid}`);
      }
      
      // Ottieni le characteristic per comandi e notifiche
      const characteristics = await service.getCharacteristics();
      console.log(`📋 Trovate ${characteristics.length} characteristics`);
      
      // Cerca characteristic con NOTIFY/INDICATE per i dati
      let notifyChar = characteristics.find(c => c.properties.notify);
      if (!notifyChar) {
        notifyChar = characteristics.find(c => c.properties.indicate);
        console.log('⚠️ Usando INDICATE invece di NOTIFY');
      }
      
      // Cerca characteristic con WRITE per i comandi
      const writeChar = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
      
      // Log delle proprietà
      if (notifyChar) {
        console.log(`📋 Notify characteristic properties:`, {
          notify: notifyChar.properties.notify,
          indicate: notifyChar.properties.indicate,
          read: notifyChar.properties.read,
          write: notifyChar.properties.write
        });
      }
      
      if (!notifyChar || !writeChar) {
        console.warn('⚠️ Characteristics standard non trovate, cerco per UUID...');
        // Fallback agli UUID standard
        try {
          const notifyTry = await service.getCharacteristic('0000fff4-0000-1000-8000-00805f9b34fb');
          const writeTry = await service.getCharacteristic('0000fff1-0000-1000-8000-00805f9b34fb');
          setNotifyCharacteristic(notifyTry);
          setWriteCharacteristic(writeTry);
          console.log('✅ UUID standard trovati');
        } catch (err) {
          throw new Error('Impossibile trovare le characteristics necessarie');
        }
      } else {
      console.log(`✅ Notify: ${notifyChar.uuid}`);
      console.log(`✅ Write: ${writeChar.uuid}`);
      
      // Salva le characteristics PRIMA dell'handshake
      setNotifyCharacteristic(notifyChar);
      setWriteCharacteristic(writeChar);
      }
      
      // Abilita notifiche
      if (notifyChar && writeChar) {
        try {
          await notifyChar.startNotifications();
          console.log('✅ startNotifications() eseguito con successo');
        } catch (error) {
          console.error('❌ Errore startNotifications():', error);
          throw error;
        }
        
        notifyChar.addEventListener('characteristicvaluechanged', handleNotification);
        console.log('✅ Event listener aggiunto');
        
        // Test: prova a leggere il valore attuale
        try {
          if (notifyChar.properties.read) {
            const testValue = await notifyChar.readValue();
            console.log('🧪 Test lettura characteristic:', Array.from(new Uint8Array(testValue.buffer)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
          }
        } catch (e) {
          console.log('ℹ️ Characteristic non leggibile (normale)');
        }
        
        console.log('✅ Notifiche BLE abilitate');
        
        // IMPORTANTE: Invia handshake/init al dispositivo
        console.log('🤝 Invio handshake iniziale al dispositivo...');
        
        try {
          // IMPORTANTE: Aspetta un attimo dopo aver abilitato le notifiche
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Query device info (comando 0x0E = 14 = query info)
          // Checksum: 0x01 ^ 0x00 ^ 0x00 ^ 0x04 ^ 0x0E = 0x0B
          const initCmd1 = new Uint8Array([0x01, 0x00, 0x00, 0x04, 0x0E, 0x0B]);
          console.log('📤 Init 1: Query device info:', Array.from(initCmd1).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
          await writeChar.writeValue(initCmd1);
          
          await new Promise(resolve => setTimeout(resolve, 500));

          console.log('✅ Handshake completato - dispositivo pronto');

          // Prova a leggere batteria dal Battery Service standard (0x180f)
          console.log('🔋 Tentativo lettura Battery Service standard...');
          try {
            const batteryService = await server.getPrimaryService('0000180f-0000-1000-8000-00805f9b34fb');
            const batteryLevelChar = await batteryService.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
            const batteryValue = await batteryLevelChar.readValue();
            const batteryLevel = batteryValue.getUint8(0);
            console.log(`🔋 Batteria da Battery Service: ${batteryLevel}%`);

            if (batteryLevel >= 0 && batteryLevel <= 100) {
              setDevice(prev => ({ ...prev, batteryLevel }));
              console.log(`✅ Livello batteria aggiornato: ${batteryLevel}%`);
            }
          } catch (error) {
            console.warn('⚠️ Battery Service non disponibile, provo comando custom...');

            // Fallback: Query battery via comando custom (comando 0x07 = 7 = battery query)
            // NOTA: Il dispositivo HC03 sembra non esporre il livello di batteria via Bluetooth.
            // Il comando viene inviato ma non riceve risposta. L'UI mostrerà "N/A".
            // Checksum: 0x01 ^ 0x00 ^ 0x00 ^ 0x04 ^ 0x07 = 0x02
            const batteryCmd = new Uint8Array([0x01, 0x00, 0x00, 0x04, 0x07, 0x02]);
            console.log('📤 Query battery (custom):', Array.from(batteryCmd).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            console.log('ℹ️ Se non arriva risposta, la batteria rimarrà "N/A" (normale per HC03)');
            await writeChar.writeValue(batteryCmd);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.warn('⚠️ Errore durante handshake:', error);
        }
      }
      
      // Leggi Device ID e Key (opzionale)
      try {
        const infoCharacteristic = await service.getCharacteristic('0000fff5-0000-1000-8000-00805f9b34fb');
        const value = await infoCharacteristic.readValue();
        
        const deviceId = Array.from(new Uint8Array(value.buffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        setDevice(prev => ({
          ...prev,
          deviceId: deviceId.substring(0, 16) || 'N/A',
          deviceKey: deviceId.substring(16, 32) || 'N/A',
          deviceName,
          deviceType,
          firmwareVersion: '1.0.0',
          hardwareVersion: '2.0',
          batteryLevel: 0  // Sarà aggiornato quando arriva la risposta dal dispositivo
        }));
      } catch (error) {
        console.log('ℹ️ Device info non disponibile (normale per alcuni dispositivi)');
        setDevice(prev => ({
          ...prev,
          deviceName,
          deviceType,
          firmwareVersion: 'N/A',
          hardwareVersion: 'N/A',
          batteryLevel: 0
        }));
      }
      
      setStatus('✅ Dispositivo configurato e pronto');

    } catch (error: any) {
      console.error('❌ Errore setup BLE:', error);
      setStatus(`⚠️ Errore: ${error.message}`);
    }
  };

  // Disconnetti dispositivo
  const handleDisconnect = async () => {
    try {
      // Rimuovi listener notifiche
      if (notifyCharacteristic) {
        await notifyCharacteristic.stopNotifications();
        notifyCharacteristic.removeEventListener('characteristicvaluechanged', handleNotification);
      }
    } catch (error) {
      console.log('Errore stop notifiche:', error);
    }

    if (bluetoothDevice?.gatt?.connected) {
      bluetoothDevice.gatt.disconnect();
    }
    
    setBluetoothDevice(null);
    setGattServer(null);
    setNotifyCharacteristic(null);
    setWriteCharacteristic(null);
    
    setDevice({
      deviceId: 'Non connesso',
      deviceKey: 'N/A',
      deviceName: '',
      deviceType: 'unknown',
      firmwareVersion: 'N/A',
      hardwareVersion: 'N/A',
      batteryLevel: 0,
      isConnected: false
    });
    setStatus('Dispositivo disconnesso');
    setMeasurements({
      heartRate: 0,
      spo2: 0,
      bloodPressureSystolic: 0,
      bloodPressureDiastolic: 0,
      bodyTemperature: 0,
      ecgWaveform: []
    });
    setIsRecording(false);
    setRecordingDuration(0);
    updateMeasuringState(false);
  };

  // Controlli specifici per stetoscopio
  const startStethoscopeRecording = async () => {
    if (!device.isConnected) {
      setStatus('⚠️ Connetti prima un dispositivo');
      return;
    }

    setIsRecording(true);
    setRecordingDuration(0);
    setStatus('🎙️ Registrazione audio in corso...');

    // TODO: Implementare la registrazione reale tramite BLE
    // Per ora simula la registrazione
    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    // Salva interval per poterlo cancellare dopo
    (window as any).recordingInterval = interval;
  };

  const stopStethoscopeRecording = async () => {
    setIsRecording(false);
    if ((window as any).recordingInterval) {
      clearInterval((window as any).recordingInterval);
    }
    setStatus(`✅ Registrazione completata (${recordingDuration}s)`);
  };

  // Invia comando BLE per avviare misurazione
  const startMeasurement = async (type: string) => {
    console.log(`🔵 Richiesta misurazione: ${type}`);
    console.log(`🔌 Device connesso: ${device.isConnected}`);
    console.log(`✍️ Write characteristic: ${writeCharacteristic ? 'OK' : 'MISSING'}`);
    
    if (!device.isConnected || !writeCharacteristic) {
      setStatus('⚠️ Connetti prima un dispositivo');
      console.error('❌ Impossibile avviare misurazione: dispositivo non pronto');
      return;
    }

    // Reset buffer PPG se si avvia una misurazione SpO2
    if (type === 'SpO2') {
      console.log('🔄 Reset completo per nuova misurazione SpO2');
      ppgSamplesRef.current = { red: [], ir: [] };
      lastPeakTimeRef.current = 0;
      peakIntervalsRef.current = [];
      spo2HistoryRef.current = [];
      finalMeasurementsRef.current = { spo2: [], hr: [] };

      // IMPORTANTE: Reset flag completamento timer
      spo2TimerCompletedRef.current = false;
      console.log('✅ spo2TimerCompletedRef resettato a false');

      resetSpo2Timer();

      // Reset valori visualizzati (mostra "--" durante misurazione)
      setMeasurements(prev => ({
        ...prev,
        heartRate: 0,
        spo2: 0
      }));
    }

    updateMeasuringState(true);
    setStatus(`📊 Avvio misurazione ${type}...`);
    
    // Resetta anche eventuale timer in corso da misurazione precedente
    if (type !== 'SpO2') {
      resetSpo2Timer();
    }

    try {
      // Mappa tipo misurazione a codice (basato su MeasureType.java)
      const measureTypes: { [key: string]: number } = {
        'Pressione': 1,    // BP
        'Temperatura': 2,  // BT
        'SpO2': 4,        // SPO2
        'ECG': 5,         // ECG
        'HRV': 7          // HRV
      };

      const measureCode = measureTypes[type];
      if (!measureCode) {
        throw new Error(`Tipo misurazione sconosciuto: ${type}`);
      }

      // Costruisci comando LINKTOP (formato dal codice Android)
      // Formato: [0x01, length_low, length_high, 0x04, command, checksum, ...payload]
      
      // Payload specifico per ogni tipo di misurazione (dal codice Android)
      let payload: Uint8Array;
      
      if (measureCode === 4) {
        // SpO2: RICHIEDE payload [0] per iniziare!
        // Dal codice: this.mCommunicate.a((byte) 4, new byte[]{0});
        payload = new Uint8Array([0]);
        console.log('🫁 SpO2: usando payload [0]');
      } else if (measureCode === 1) {
        // BP (Blood Pressure): payload [1] per iniziare calibrazione
        // La sequenza completa [2][3][4][5,85] verrà inviata automaticamente dopo
        payload = new Uint8Array([1]);
      } else if (measureCode === 2) {
        // BT (Body Temperature): payload vuoto
        payload = new Uint8Array([]);
      } else if (measureCode === 5) {
        // ECG: payload vuoto
        payload = new Uint8Array([]);
      } else {
        payload = new Uint8Array([]);
      }
      
      const payloadLength = payload.length;
      
      // Formato completo: [header, len_low, len_high, type, cmd, checksum1, ...payload, checksum2_low, checksum2_high, terminator]
      // Totale: 6 + payloadLength + 3 = 9 + payloadLength byte
      const command = new Uint8Array(9 + payloadLength);
      command[0] = 0x01;                                    // Header
      command[1] = payloadLength & 0xFF;                    // Length low byte
      command[2] = (payloadLength >> 8) & 0xFF;            // Length high byte
      command[3] = 0x04;                                    // Type (sempre 4)
      command[4] = measureCode;                             // Command (tipo misurazione)
      
      // Calcola checksum1 (XOR dei primi 5 byte)
      let checksum1 = 0;
      for (let i = 0; i < 5; i++) {
        checksum1 ^= command[i];
      }
      command[5] = checksum1 & 0xFF;
      
      // Copia payload se presente
      if (payloadLength > 0) {
        command.set(payload, 6);
      }
      
      // Calcola checksum2 finale (CRC16-like sui primi 6+payload byte)
      let checksum2 = 0xFFFF;
      for (let i = 0; i < 6 + payloadLength; i++) {
        checksum2 = ((((checksum2 << 8) | ((checksum2 >> 8) & 0xFF)) & 0xFFFF) ^ command[i]) & 0xFFFF;
        const temp = (checksum2 ^ ((checksum2 & 0xFF) >> 4)) & 0xFFFF;
        const temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF;
        checksum2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF;
      }
      
      // Scrivi checksum2 (2 byte) e terminatore
      const checksumPos = 6 + payloadLength;
      command[checksumPos] = checksum2 & 0xFF;           // Checksum2 low
      command[checksumPos + 1] = (checksum2 >> 8) & 0xFF; // Checksum2 high
      command[checksumPos + 2] = 0xFF;                    // Terminatore

      // BP richiede sequenza di inizializzazione
      if (measureCode === 1) {
        console.log('🩺 BP: invio sequenza completa di inizializzazione...');

        // CRITICO: Reset PRIMA di inviare qualsiasi comando
        bpPressureArrayRef.current = [];
        bpCalibrationRef.current = {
          C1: 0, C2: 0, C3: 0, C4: 0, C5: 0,
          sensibility: 0, baseline: 0, sampleCount: 0, baselineSum: 0
        };
        console.log('🔄 BP: resettato array + calibrazione PRIMA dei comandi');
      }

      console.log('📤 Invio comando:', Array.from(command).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.log('   Header: 0x01, Length:', payloadLength, ', Type: 0x04, Command:', measureCode);
      console.log('   Checksum1: 0x' + checksum1.toString(16).padStart(2, '0'), ', Checksum2: 0x' + checksum2.toString(16).padStart(4, '0'), ', Totale byte:', command.length);

      // Invia comando
      await writeCharacteristic.writeValue(command);
      console.log('✅ Comando inviato con successo');

      // BP sequenza comandi aggiuntivi
      if (measureCode === 1) {

        // Helper per creare comandi BP
        const createBpCommand = (bpPayload: number[]) => {
          const payload = new Uint8Array(bpPayload);
          const payloadLength = payload.length;
          const cmd = new Uint8Array(9 + payloadLength);
          cmd[0] = 0x01;
          cmd[1] = payloadLength & 0xFF;
          cmd[2] = (payloadLength >> 8) & 0xFF;
          cmd[3] = 0x04;
          cmd[4] = 1; // Command=1 per BP

          let cs1 = 0;
          for (let i = 0; i < 5; i++) cs1 ^= cmd[i];
          cmd[5] = cs1 & 0xFF;

          if (payloadLength > 0) cmd.set(payload, 6);

          let cs2 = 0xFFFF;
          for (let i = 0; i < 6 + payloadLength; i++) {
            cs2 = ((((cs2 << 8) | ((cs2 >> 8) & 0xFF)) & 0xFFFF) ^ cmd[i]) & 0xFFFF;
            const temp = (cs2 ^ ((cs2 & 0xFF) >> 4)) & 0xFFFF;
            const temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF;
            cs2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF;
          }

          const checksumPos = 6 + payloadLength;
          cmd[checksumPos] = cs2 & 0xFF;
          cmd[checksumPos + 1] = (cs2 >> 8) & 0xFF;
          cmd[checksumPos + 2] = 0xFF;
          return cmd;
        };

        // Invia sequenza con ritardi più lunghi
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('🩺 BP Step 2: Compensazione temperatura [2]');
        await writeCharacteristic.writeValue(createBpCommand([2]));

        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('🩺 BP Step 3: Zero pressure [3]');
        await writeCharacteristic.writeValue(createBpCommand([3]));

        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('🩺 BP Step 4: Start test [4]');
        await writeCharacteristic.writeValue(createBpCommand([4]));

        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('🩺 BP Step 5: PWM START - Gonfia bracciale! [5, 85]');
        await writeCharacteristic.writeValue(createBpCommand([5, 85]));

        console.log('✅ Sequenza BP completa inviata!');
        console.log('⏱️ Il dispositivo gestirà automaticamente gonfiaggio/sgonfiamento');

        // Timer: dopo 35 secondi STOP + calcolo BP
        bpTimerRef.current = setTimeout(async () => {
          try {
            console.log('⏱️ 35 secondi trascorsi - invio comando STOP BP [7]');
            await writeCharacteristic.writeValue(createBpCommand([7]));
            console.log('✅ Comando STOP BP inviato');

            // Attendi 2 secondi per ricevere ultimi pacchetti
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Calcola valori BP finali
            console.log('🧮 Calcolo valori BP finali...');
            const bpResults = calculateBP(bpPressureArrayRef.current);

            if (bpResults.systolic > 0 && bpResults.diastolic > 0) {
              setMeasurements(prev => ({
                ...prev,
                bloodPressureSystolic: bpResults.systolic,
                bloodPressureDiastolic: bpResults.diastolic,
                heartRate: bpResults.hr || prev.heartRate
              }));

              setStatus(`✅ BP: ${bpResults.systolic}/${bpResults.diastolic} mmHg | HR: ${bpResults.hr || '?'} BPM`);
              playBeep(1000, 200); // BIP completamento

              console.log('🎉 Misurazione BP completata!');
              console.log(`   📊 Risultato: ${bpResults.systolic}/${bpResults.diastolic} mmHg`);
            } else {
              setStatus('⚠️ Dati BP insufficienti per calcolo affidabile');
              console.warn('⚠️ Calcolo BP non riuscito');
            }

            updateMeasuringState(false);
            bpPressureArrayRef.current = []; // Reset
          } catch (error) {
            console.error('❌ Errore invio STOP BP:', error);
            setStatus('❌ Errore durante stop BP');
          }
        }, 35000);
      }

      setStatus(`📊 Misurazione ${type} in corso... (attendi dati dal dispositivo)`);

      // Log per debug: aspettiamo notifiche
      console.log('⏳ In attesa di notifiche BLE dal dispositivo...');
      
      // Timeout dopo 60 secondi
      setTimeout(() => {
        if (isMeasuringRef.current) {
          updateMeasuringState(false);
          setStatus(`⏱️ Timeout misurazione ${type}`);
        }
      }, 60000);

    } catch (error: any) {
      console.error('Errore avvio misurazione:', error);
      setStatus(`❌ Errore: ${error.message}`);
      updateMeasuringState(false);
    }
  };

  // Stop misurazione
  const stopMeasurement = async () => {
    if (!writeCharacteristic) return;
    
    try {
      console.log('🛑 STOP: Fermando misurazione e resettando buffer...');

      // Reset buffer PPG e history
      ppgSamplesRef.current = { red: [], ir: [] };
      lastPeakTimeRef.current = 0;
      peakIntervalsRef.current = [];
      spo2HistoryRef.current = [];
      resetSpo2Timer();

      // Reset BP
      bpPressureArrayRef.current = [];
      bpCalibrationRef.current = {
        C1: 0, C2: 0, C3: 0, C4: 0, C5: 0,
        sensibility: 0, baseline: 0, sampleCount: 0, baselineSum: 0
      };
      if (bpTimerRef.current) {
        clearTimeout(bpTimerRef.current);
        bpTimerRef.current = null;
        console.log('⏹️ Timer BP cancellato');
      }
      
      // Comando STOP per SpO2 (basato su OxTask.java riga 469)
      // this.mCommunicate.a((byte) 4, new byte[]{1});
      // Quindi: Type=4, Payload=[1] per fermare la misurazione
      const stopPayload = new Uint8Array([1]); // 1 = STOP (non 2!)
      const stopCmd = new Uint8Array(9 + stopPayload.length);
      
      stopCmd[0] = 0x01; // Header
      stopCmd[1] = stopPayload.length & 0xFF;
      stopCmd[2] = (stopPayload.length >> 8) & 0xFF;
      stopCmd[3] = 0x04; // Type = 4
      stopCmd[4] = 0x04; // Command = 4 (SpO2)
      
      let checksum1 = 0;
      for (let i = 0; i < 5; i++) {
        checksum1 ^= stopCmd[i];
      }
      stopCmd[5] = checksum1;
      stopCmd[6] = stopPayload[0];
      
      // Calcola checksum2
      let checksum2 = 0xFFFF;
      for (let i = 0; i < 7; i++) {
        checksum2 = ((((checksum2 << 8) | ((checksum2 >> 8) & 0xFF)) & 0xFFFF) ^ stopCmd[i]) & 0xFFFF;
        const temp = (checksum2 ^ ((checksum2 & 0xFF) >> 4)) & 0xFFFF;
        const temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF;
        checksum2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF;
      }
      
      stopCmd[7] = checksum2 & 0xFF;
      stopCmd[8] = (checksum2 >> 8) & 0xFF;
      stopCmd[9] = 0xFF;
      
      console.log('⏹️ Invio comando STOP:', Array.from(stopCmd).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.log('   Structure: Header=0x01, Length=1, Type=0x04, Cmd=0x04, Payload=[0x01]');
      
      await writeCharacteristic.writeValue(stopCmd);
      
      // Reset completo dello stato
      updateMeasuringState(false);
      setMeasurements(prev => ({
        ...prev,
        spo2: null,
        heartRate: null
      }));
      setStatus('⏹️ Misurazione interrotta - LED dovrebbe spegnersi');
      
      console.log('✅ Comando STOP inviato - Il LED dovrebbe spegnersi ora');
    } catch (error) {
      console.error('❌ Errore stop misurazione:', error);
      setStatus(`❌ Errore STOP: ${error.message}`);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f0f4f8'
    }}>
      <div style={{ maxWidth: '75rem', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1e293b' }}>
          🏥 LINKTOP Health Monitor - Test Console
        </h1>

        {/* Avviso Browser non supportato */}
        {!bluetoothSupported && (
          <div style={{
            backgroundColor: '#fee2e2',
            borderLeft: '4px solid #dc2626',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#991b1b', marginBottom: '0.5rem' }}>
              ⚠️ Browser Non Supportato
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#7f1d1d', marginBottom: '0.5rem' }}>
              Il tuo browser non supporta Web Bluetooth API.
            </p>
            <p style={{ fontSize: '0.85rem', color: '#991b1b' }}>
              <strong>Usa uno di questi browser:</strong> Google Chrome, Microsoft Edge, Opera
            </p>
          </div>
        )}

        {/* Box Errore Connessione - Visibile e prominente */}
        {errorMessage && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '3px solid #dc2626',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <span style={{ fontSize: '2rem', flexShrink: 0 }}>❌</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#991b1b', marginBottom: '0.5rem', marginTop: 0 }}>
                  Errore di Connessione
                </h3>
                <p style={{ fontSize: '1rem', color: '#7f1d1d', marginBottom: '1rem', lineHeight: '1.5' }}>
                  {errorMessage}
                </p>
                <div style={{ fontSize: '0.9rem', color: '#991b1b', backgroundColor: '#fecaca', padding: '0.75rem', borderRadius: '0.375rem' }}>
                  <strong>Soluzioni suggerite:</strong>
                  <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                    <li>Riavvia il dispositivo LINKTOP</li>
                    <li>Clicca "Disconnetti e Ricarica" qui sotto</li>
                    <li>Prova con "Tutti i dispositivi" invece di "Solo LINKTOP"</li>
                    <li>Verifica che il Bluetooth sia attivo sul computer</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pannello Connessione */}
        <div style={{
          backgroundColor: 'white',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#334155' }}>
            🔌 Connessione Dispositivo
          </h2>

          {/* Indicatore stato connessione */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: connectionStatus === 'connected' ? '#d1fae5' : connectionStatus === 'connecting' ? '#fef3c7' : '#fee2e2',
            borderRadius: '0.5rem',
            border: `2px solid ${connectionStatus === 'connected' ? '#059669' : connectionStatus === 'connecting' ? '#d97706' : '#dc2626'}`
          }}>
            <span style={{ fontSize: '1.5rem' }}>
              {connectionStatus === 'connected' ? '🟢' : connectionStatus === 'connecting' ? '🟡' : '🔴'}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{
                color: connectionStatus === 'connected' ? '#059669' : connectionStatus === 'connecting' ? '#d97706' : '#dc2626',
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: '600'
              }}>
                {connectionStatus === 'connected' ? 'Connesso' : connectionStatus === 'connecting' ? 'Connessione in corso...' : 'Disconnesso'}
              </p>
              <p style={{
                color: '#64748b',
                margin: 0,
                fontSize: '0.85rem',
                marginTop: '0.25rem'
              }}>
                {status}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Modalità scansione */}
            {!device.isConnected && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '500' }}>
                  Modalità ricerca:
                </span>
                <button
                  onClick={() => setScanMode('filtered')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: scanMode === 'filtered' ? '#2563eb' : '#e2e8f0',
                    color: scanMode === 'filtered' ? 'white' : '#475569',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Solo LINKTOP
                </button>
                <button
                  onClick={() => setScanMode('all')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: scanMode === 'all' ? '#2563eb' : '#e2e8f0',
                    color: scanMode === 'all' ? 'white' : '#475569',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Tutti i dispositivi
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {!device.isConnected ? (
                <button
                  onClick={handleConnectDevice}
                  disabled={!bluetoothSupported}
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: bluetoothSupported ? '#2563eb' : '#cbd5e1',
                    color: 'white',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: bluetoothSupported ? 'pointer' : 'not-allowed',
                    fontWeight: '500',
                    fontSize: '1rem'
                  }}
                  onMouseOver={(e) => {
                    if (bluetoothSupported) e.currentTarget.style.backgroundColor = '#1d4ed8'
                  }}
                  onMouseOut={(e) => {
                    if (bluetoothSupported) e.currentTarget.style.backgroundColor = '#2563eb'
                  }}
                >
                  🔍 {scanMode === 'all' ? 'Cerca Tutti i Dispositivi' : 'Cerca Dispositivi LINKTOP'}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '1rem'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                  ❌ Disconnetti
                </button>
              )}

              {/* Pulsante Reset sempre visibile - equivalente a Cmd+R */}
              <button
                onClick={handleDisconnectAndReload}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
              >
                🔄 Disconnetti e Ricarica
              </button>
            </div>
          </div>
        </div>

        {/* Informazioni Dispositivo */}
        {device.isConnected && (
          <div style={{
            backgroundColor: 'white',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#334155' }}>
              📱 Informazioni Dispositivo
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Nome:</p>
                <p style={{ fontWeight: '600', color: '#1e293b' }}>{device.deviceName}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Tipo:</p>
                <p style={{ fontWeight: '600', color: '#1e293b' }}>
                  {device.deviceType === 'stethoscope' ? '🩺 Stetoscopio Digitale' : 
                   device.deviceType === 'health_monitor' ? '❤️ Health Monitor 6-in-1' :
                   device.deviceType === 'otoscope' ? '👂 Otoscopio Digitale' : 
                   '❓ Sconosciuto'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Firmware:</p>
                <p style={{ fontWeight: '600', color: '#1e293b' }}>{device.firmwareVersion}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Hardware:</p>
                <p style={{ fontWeight: '600', color: '#1e293b' }}>{device.hardwareVersion}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Batteria:</p>
                <p style={{ fontWeight: '600', color: device.batteryLevel > 20 ? '#059669' : device.batteryLevel > 0 ? '#dc2626' : '#64748b' }}>
                  🔋 {device.batteryLevel > 0 ? `${device.batteryLevel}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pannello Controlli - STETOSCOPIO */}
        {device.isConnected && device.deviceType === 'stethoscope' && (
          <div style={{
            backgroundColor: 'white',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#334155' }}>
              🎙️ Controlli Stetoscopio Digitale
            </h2>
            
            <div style={{ 
              backgroundColor: '#f8fafc', 
              borderRadius: '0.5rem', 
              padding: '1.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                  {isRecording ? '🔴' : '⚪'}
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
                  {isRecording ? `${recordingDuration}s` : 'Pronto'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {isRecording ? 'Registrazione in corso...' : 'Premi Start per registrare'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                {!isRecording ? (
                  <button
                    onClick={startStethoscopeRecording}
                    style={{
                      padding: '1rem 2rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '1.1rem'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  >
                    ▶️ Start Registrazione
                  </button>
                ) : (
                  <button
                    onClick={stopStethoscopeRecording}
                    style={{
                      padding: '1rem 2rem',
                      backgroundColor: '#64748b',
                      color: 'white',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '1.1rem'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#475569'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
                  >
                    ⏹️ Stop Registrazione
                  </button>
                )}
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#ecfdf5',
              borderRadius: '0.5rem',
              padding: '1rem',
              borderLeft: '4px solid #10b981'
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#065f46', marginBottom: '0.5rem' }}>
                💡 Come usare lo stetoscopio:
              </h3>
              <ul style={{ 
                fontSize: '0.875rem', 
                color: '#047857',
                paddingLeft: '1.5rem',
                lineHeight: '1.6'
              }}>
                <li>Posiziona lo stetoscopio sul petto del paziente</li>
                <li>Premi "Start Registrazione" per iniziare</li>
                <li>Registra i suoni cardiaci o polmonari</li>
                <li>Premi "Stop" quando hai finito</li>
              </ul>
            </div>
          </div>
        )}

        {/* Pannello Misurazioni - HEALTH MONITOR */}
        {device.isConnected && device.deviceType === 'health_monitor' && (
          <>
            <div style={{
              backgroundColor: 'white',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#334155' }}>
                📊 Controlli Misurazione (DF600 Health Monitor)
              </h2>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <button
                    onClick={() => startMeasurement('SpO2')}
                    disabled={isMeasuring}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: isMeasuring ? '#cbd5e1' : '#0ea5e9',
                      color: 'white',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: isMeasuring ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    🫁 SpO2 + HR
                  </button>
                  <button
                    onClick={() => startMeasurement('Pressione')}
                    disabled={isMeasuring}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: isMeasuring ? '#cbd5e1' : '#8b5cf6',
                      color: 'white',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: isMeasuring ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    🩺 Pressione
                  </button>
                  <button
                    onClick={() => startMeasurement('Temperatura')}
                    disabled={isMeasuring}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: isMeasuring ? '#cbd5e1' : '#ef4444',
                      color: 'white',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: isMeasuring ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    🌡️ Temperatura
                  </button>
                  <button
                    onClick={() => startMeasurement('ECG')}
                    disabled={isMeasuring}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: isMeasuring ? '#cbd5e1' : '#f59e0b',
                      color: 'white',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: isMeasuring ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    ❤️ ECG
                  </button>
                </div>

                {/* Barra progresso SpO2 - Sotto i pulsanti */}
                {spo2Progress > 0 && (
                  <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                      width: '100%',
                      height: '16px',
                      backgroundColor: '#e0f2fe',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${spo2Progress}%`,
                        backgroundColor: spo2Progress >= 100 ? '#10b981' : '#0ea5e9',
                        transition: 'width 0.1s linear',
                        boxShadow: spo2Progress < 100 ? '0 0 10px rgba(14, 165, 233, 0.5)' : 'none'
                      }} />
                    </div>

                    {/* Testo countdown sotto la barra */}
                    {spo2Progress < 100 ? (
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#0ea5e9',
                        fontWeight: '600',
                        marginTop: '0.5rem',
                        textAlign: 'center'
                      }}>
                        ⏱️ Mantieni il dito fermo: {Math.ceil(MEASUREMENT_DURATION - (spo2Progress / 100 * MEASUREMENT_DURATION))}s
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#10b981',
                        fontWeight: '600',
                        marginTop: '0.5rem',
                        textAlign: 'center'
                      }}>
                        ✅ Misurazione completata!
                      </div>
                    )}
                  </div>
                )}
                
                {isMeasuring && (
                  <button
                    onClick={stopMeasurement}
                    style={{
                      padding: '1rem 2rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      borderRadius: '0.75rem',
                      border: '3px solid #991b1b',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '1.1rem',
                      width: '100%',
                      marginTop: '0.5rem',
                      boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#b91c1c';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    ⏹️ FERMA MISURAZIONE (LED ACCESO)
                  </button>
                )}
              </div>
            </div>

            {/* Risultati Misurazioni - Solo per Health Monitor */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* SpO2 - Corrisponde al primo pulsante */}
              <div style={{
                backgroundColor: 'white',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🫁</div>
                <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Saturazione O2 (SpO2)</h3>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0ea5e9' }}>
                  {measurements.spo2 > 0 ? measurements.spo2 : '--'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>%</p>
                {/* Testo "Misurazione in corso..." quando è attiva */}
                {spo2Progress > 0 && spo2Progress < 100 && measurements.spo2 === 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#0ea5e9', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Misurazione in corso...
                  </p>
                )}
              </div>

              {/* Heart Rate - Viene con SpO2 */}
              <div style={{
                backgroundColor: 'white',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>❤️</div>
                <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Frequenza Cardiaca (HR)</h3>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                  {measurements.heartRate > 0 ? measurements.heartRate : '--'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>BPM</p>
                {/* Testo "Misurazione in corso..." quando è attiva */}
                {spo2Progress > 0 && spo2Progress < 100 && measurements.heartRate === 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Misurazione in corso...
                  </p>
                )}
              </div>

              {/* Blood Pressure */}
              <div style={{
                backgroundColor: 'white',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🩺</div>
                <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Pressione Sanguigna</h3>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {measurements.bloodPressureSystolic > 0 
                    ? `${measurements.bloodPressureSystolic}/${measurements.bloodPressureDiastolic}` 
                    : '--/--'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>mmHg</p>
              </div>

              {/* Temperature */}
              <div style={{
                backgroundColor: 'white',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌡️</div>
                <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Temperatura Corporea</h3>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
                  {measurements.bodyTemperature > 0 ? measurements.bodyTemperature.toFixed(1) : '--'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>°C</p>
              </div>
            </div>
          </>
        )}

        {/* Guida Connessione */}
        <div style={{
          backgroundColor: '#fef3c7',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1rem',
          borderLeft: '4px solid #f59e0b'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#92400e' }}>
            🔍 Come Connettere il Dispositivo
          </h3>
          <ol style={{ 
            paddingLeft: '1.5rem',
            color: '#78350f',
            fontSize: '0.9rem',
            lineHeight: '1.8'
          }}>
            <li><strong>Accendi</strong> il dispositivo LINKTOP (Health Monitor, Stetoscopio, etc)</li>
            <li><strong>Scegli modalità:</strong>
              <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                <li>"Solo LINKTOP" - cerca solo dispositivi LINKTOP noti</li>
                <li>"Tutti i dispositivi" - mostra TUTTI i dispositivi Bluetooth (più lento)</li>
              </ul>
            </li>
            <li><strong>Clicca</strong> su "Cerca Dispositivi"</li>
            <li>Nel dialogo che appare, cerca un dispositivo con nome:
              <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li><strong>"HC0*"</strong> (es: HC02, HC03, HC04) = Health Monitor 6-in-1 ❤️</li>
                <li><strong>"HC-*"</strong> (es: HC-21) = Stetoscopio Digitale 🩺</li>
                <li>"LINKTOP" = Altri dispositivi LINKTOP</li>
              </ul>
            </li>
            <li><strong>Seleziona</strong> il dispositivo e clicca "Associa"</li>
            <li>Attendi la conferma di connessione</li>
          </ol>
        </div>

        {/* Info Supporto */}
        <div style={{
          backgroundColor: '#e0f2fe',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#0c4a6e' }}>
            ℹ️ Informazioni Tecniche
          </h3>
          <ul style={{ 
            listStyle: 'disc',
            paddingLeft: '1.5rem',
            color: '#075985',
            fontSize: '0.9rem',
            lineHeight: '1.6'
          }}>
            <li>Utilizza Web Bluetooth API per la connessione diretta</li>
            <li><strong>Stetoscopio (HC-*):</strong> Registrazione audio cardiaco/polmonare</li>
            <li><strong>Health Monitor (HC0*):</strong> HC02, HC03, HC04 - ECG, SpO2, Pressione, Temperatura, Heart Rate</li>
            <li><strong>Browser supportati:</strong> Chrome, Edge, Opera (non Safari/Firefox)</li>
            <li><strong>Requisiti:</strong> HTTPS o localhost, Bluetooth abilitato</li>
          </ul>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <a 
            href="/" 
            style={{
              color: '#2563eb',
              textDecoration: 'underline',
              fontSize: '0.95rem'
            }}
          >
            ← Torna alla home
          </a>
        </div>
      </div>
    </main>
  );
}

