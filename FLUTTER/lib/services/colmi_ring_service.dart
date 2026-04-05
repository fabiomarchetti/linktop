// lib/services/colmi_ring_service.dart
// Servizio BLE per comunicazione con anello Colmi R02/R06/R10

import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

class ColmiRingService {
  // ═══════════════════════════════════════════════════════════════
  // UUID BLE COLMI
  // ═══════════════════════════════════════════════════════════════
  
  static const String SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
  static const String CHAR_WRITE = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  static const String CHAR_NOTIFY = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

  // ═══════════════════════════════════════════════════════════════
  // COMANDI BLE (documentati da reverse engineering)
  // ═══════════════════════════════════════════════════════════════
  
  static const int CMD_SET_TIME = 0x01;
  static const int CMD_GET_BATTERY = 0x03;
  static const int CMD_DEVICE_INFO = 0x07;
  static const int CMD_GET_HR_LOG = 0x15;           // Storico HR
  static const int CMD_GET_SPO2_LOG = 0x16;         // Storico SpO2
  static const int CMD_GET_SLEEP_LOG = 0x17;        // Dati sonno
  static const int CMD_GET_STRESS_LOG = 0x18;       // Dati stress
  static const int CMD_HR_LOG_SETTINGS = 0x38;      // Impostazioni log HR
  static const int CMD_GET_HRV = 0x39;              // Dati HRV
  static const int CMD_GET_STEPS = 0x43;            // Passi giornalieri
  static const int CMD_GET_REALTIME_HR = 0x69;      // Real-time heart rate
  static const int CMD_GET_REALTIME_SPO2 = 0x6A;    // Real-time SpO2

  // ═══════════════════════════════════════════════════════════════
  // STATO CONNESSIONE
  // ═══════════════════════════════════════════════════════════════
  
  BluetoothDevice? _device;
  BluetoothCharacteristic? _writeChar;
  BluetoothCharacteristic? _notifyChar;
  StreamSubscription? _notifySubscription;
  
  bool _isConnected = false;
  String? _deviceName;
  String? _firmwareVersion;
  
  // Callback per notifiche
  final _responseController = StreamController<Uint8List>.broadcast();
  Stream<Uint8List> get responses => _responseController.stream;

  // ═══════════════════════════════════════════════════════════════
  // SCANSIONE E CONNESSIONE
  // ═══════════════════════════════════════════════════════════════

  /// Cerca anelli Colmi nelle vicinanze
  Future<List<ScanResult>> scanForRings({
    Duration timeout = const Duration(seconds: 10),
  }) async {
    List<ScanResult> rings = [];
    
    // Assicurati che il Bluetooth sia acceso
    if (await FlutterBluePlus.adapterState.first != BluetoothAdapterState.on) {
      throw Exception('Bluetooth non attivo');
    }
    
    // Avvia scansione
    await FlutterBluePlus.startScan(timeout: timeout);
    
    // Raccogli risultati
    await for (final results in FlutterBluePlus.scanResults) {
      for (ScanResult r in results) {
        String name = r.device.platformName;
        // I ring Colmi hanno nome "R02_XXXX", "R06_XXXX", "R10_XXXX"
        if (name.startsWith('R0') || name.startsWith('R1')) {
          if (!rings.any((ring) => ring.device.remoteId == r.device.remoteId)) {
            rings.add(r);
            print('📍 Trovato ring: $name (${r.rssi} dBm)');
          }
        }
      }
    }
    
    await FlutterBluePlus.stopScan();
    return rings;
  }

  /// Connetti a un anello specifico
  Future<bool> connect(BluetoothDevice device) async {
    try {
      print('🔗 Connessione a ${device.platformName}...');
      
      // Connetti con timeout
      await device.connect(
        timeout: const Duration(seconds: 15),
        autoConnect: false,
      );
      
      _device = device;
      _deviceName = device.platformName;
      
      // Scopri servizi
      List<BluetoothService> services = await device.discoverServices();
      
      // Trova il servizio e le caratteristiche Colmi
      for (BluetoothService service in services) {
        if (service.uuid.toString().toLowerCase() == SERVICE_UUID) {
          for (BluetoothCharacteristic char in service.characteristics) {
            String charUuid = char.uuid.toString().toLowerCase();
            
            if (charUuid == CHAR_WRITE) {
              _writeChar = char;
            } else if (charUuid == CHAR_NOTIFY) {
              _notifyChar = char;
              
              // Abilita notifiche
              await char.setNotifyValue(true);
              
              // Ascolta risposte
              _notifySubscription = char.onValueReceived.listen((value) {
                _responseController.add(Uint8List.fromList(value));
              });
            }
          }
        }
      }
      
      _isConnected = _writeChar != null && _notifyChar != null;
      
      if (_isConnected) {
        print('✅ Connesso a $_deviceName');
        
        // Sincronizza orologio
        await setTime(DateTime.now());
      } else {
        print('❌ Caratteristiche BLE non trovate');
        await disconnect();
      }
      
      return _isConnected;
      
    } catch (e) {
      print('❌ Errore connessione: $e');
      _isConnected = false;
      return false;
    }
  }

  /// Disconnetti dal ring
  Future<void> disconnect() async {
    await _notifySubscription?.cancel();
    await _device?.disconnect();
    
    _device = null;
    _writeChar = null;
    _notifyChar = null;
    _isConnected = false;
    
    print('🔌 Disconnesso');
  }

  // ═══════════════════════════════════════════════════════════════
  // COSTRUZIONE PACCHETTI
  // ═══════════════════════════════════════════════════════════════

  /// Costruisce un pacchetto con checksum
  Uint8List _buildPacket(int command, [List<int>? payload]) {
    List<int> packet = List.filled(16, 0);
    packet[0] = command;
    
    if (payload != null) {
      for (int i = 0; i < payload.length && i < 14; i++) {
        packet[1 + i] = payload[i];
      }
    }
    
    // Checksum: somma primi 15 byte mod 255
    int checksum = 0;
    for (int i = 0; i < 15; i++) {
      checksum += packet[i];
    }
    packet[15] = checksum % 255;
    
    return Uint8List.fromList(packet);
  }

  /// Invia comando e attende risposta
  Future<Uint8List?> _sendCommand(
    int command, {
    List<int>? payload,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    if (!_isConnected || _writeChar == null) return null;
    
    Completer<Uint8List?> completer = Completer();
    StreamSubscription? subscription;
    
    subscription = _notifyChar!.onValueReceived.listen((value) {
      if (value.isNotEmpty && value[0] == command) {
        subscription?.cancel();
        if (!completer.isCompleted) {
          completer.complete(Uint8List.fromList(value));
        }
      }
    });
    
    // Invia pacchetto
    Uint8List packet = _buildPacket(command, payload);
    await _writeChar!.write(packet.toList(), withoutResponse: false);
    
    // Attendi risposta con timeout
    return completer.future.timeout(
      timeout,
      onTimeout: () {
        subscription?.cancel();
        return null;
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // COMANDI BASE
  // ═══════════════════════════════════════════════════════════════

  /// Imposta l'ora sul ring
  Future<bool> setTime(DateTime time) async {
    List<int> payload = [
      time.year - 2000,
      time.month,
      time.day,
      time.hour,
      time.minute,
      time.second,
    ];
    
    final response = await _sendCommand(CMD_SET_TIME, payload: payload);
    return response != null && response.length > 1 && response[1] == 0x01;
  }

  /// Ottiene il livello batteria
  Future<int?> getBatteryLevel() async {
    final response = await _sendCommand(CMD_GET_BATTERY);
    if (response != null && response.length > 1) {
      return response[1]; // Percentuale batteria
    }
    return null;
  }

  /// Ottiene info dispositivo
  Future<Map<String, String>?> getDeviceInfo() async {
    final response = await _sendCommand(CMD_DEVICE_INFO);
    if (response != null && response.length > 5) {
      return {
        'firmware': '${response[1]}.${response[2]}.${response[3]}',
        'hardware': '${response[4]}.${response[5]}',
      };
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // ⭐ MISURAZIONI REAL-TIME (per trigger remoto)
  // ═══════════════════════════════════════════════════════════════

  /// Misura SpO2 in tempo reale
  Future<Map<String, int>?> measureSpO2RealTime() async {
    if (!_isConnected) return null;
    
    Completer<Map<String, int>?> completer = Completer();
    StreamSubscription? subscription;
    
    subscription = _notifyChar!.onValueReceived.listen((value) {
      if (value.isNotEmpty && value[0] == CMD_GET_REALTIME_SPO2) {
        // Formato risposta: [CMD, SpO2, HR, flags, ...]
        int spo2 = value[1];
        int hr = value[2];
        
        // Valori validi
        if (spo2 > 0 && spo2 <= 100 && hr > 0 && hr < 255) {
          subscription?.cancel();
          if (!completer.isCompleted) {
            completer.complete({'spo2': spo2, 'hr': hr});
          }
        }
      }
    });
    
    // Invia comando
    Uint8List packet = _buildPacket(CMD_GET_REALTIME_SPO2);
    await _writeChar!.write(packet.toList());
    
    // La misurazione SpO2 richiede tempo (fino a 30 secondi)
    return completer.future.timeout(
      const Duration(seconds: 30),
      onTimeout: () {
        subscription?.cancel();
        return null;
      },
    );
  }

  /// Misura HR in tempo reale (multipli campioni)
  Future<List<int>?> measureHRRealTime({int samples = 6}) async {
    if (!_isConnected) return null;
    
    List<int> readings = [];
    Completer<List<int>> completer = Completer();
    StreamSubscription? subscription;
    
    subscription = _notifyChar!.onValueReceived.listen((value) {
      if (value.isNotEmpty && value[0] == CMD_GET_REALTIME_HR) {
        // Formato: [CMD, HR1, HR2, HR3, HR4, HR5, ...]
        for (int i = 1; i < value.length && i <= samples; i++) {
          if (value[i] > 0 && value[i] < 255) {
            readings.add(value[i]);
          }
        }
        
        if (readings.length >= samples && !completer.isCompleted) {
          subscription?.cancel();
          completer.complete(readings);
        }
      }
    });
    
    Uint8List packet = _buildPacket(CMD_GET_REALTIME_HR);
    await _writeChar!.write(packet.toList());
    
    try {
      return await completer.future.timeout(const Duration(seconds: 20));
    } on TimeoutException {
      subscription?.cancel();
      return readings.isNotEmpty ? readings : null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🔄 SYNC DATI STORICI
  // ═══════════════════════════════════════════════════════════════

  /// Ottiene lo storico HR (misurazioni automatiche ogni 20-30 min)
  Future<List<Map<String, dynamic>>> getHeartRateLogs() async {
    List<Map<String, dynamic>> logs = [];
    
    if (!_isConnected) return logs;
    
    Completer<void> completer = Completer();
    StreamSubscription? subscription;
    
    subscription = _notifyChar!.onValueReceived.listen((value) {
      if (value.isNotEmpty && value[0] == CMD_GET_HR_LOG) {
        // Parsing del pacchetto HR log
        // Formato varia, tipicamente: [CMD, count, HR1, HR2, ...]
        
        if (value.length > 2) {
          int count = value[1];
          
          if (count == 0xFF || count == 0) {
            // Fine trasmissione
            subscription?.cancel();
            if (!completer.isCompleted) completer.complete();
            return;
          }
          
          // Estrai letture HR
          for (int i = 2; i < value.length && (i - 2) < count; i++) {
            if (value[i] > 0 && value[i] < 255) {
              logs.add({
                'value': value[i],
                'timestamp': DateTime.now()
                    .subtract(Duration(minutes: 30 * (logs.length + 1)))
                    .toIso8601String(),
              });
            }
          }
        }
      }
    });
    
    // Invia comando per oggi
    DateTime now = DateTime.now();
    List<int> payload = [
      now.year - 2000,
      now.month,
      now.day,
    ];
    
    Uint8List packet = _buildPacket(CMD_GET_HR_LOG, payload);
    await _writeChar!.write(packet.toList());
    
    // Attendi completamento o timeout
    await completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () {
        subscription?.cancel();
      },
    );
    
    return logs;
  }

  /// Ottiene lo storico SpO2
  Future<List<Map<String, dynamic>>> getSpO2Logs() async {
    List<Map<String, dynamic>> logs = [];
    
    if (!_isConnected) return logs;
    
    Completer<void> completer = Completer();
    StreamSubscription? subscription;
    
    subscription = _notifyChar!.onValueReceived.listen((value) {
      if (value.isNotEmpty && value[0] == CMD_GET_SPO2_LOG) {
        if (value.length > 2) {
          int count = value[1];
          
          if (count == 0xFF || count == 0) {
            subscription?.cancel();
            if (!completer.isCompleted) completer.complete();
            return;
          }
          
          for (int i = 2; i < value.length && (i - 2) < count; i++) {
            if (value[i] > 0 && value[i] <= 100) {
              logs.add({
                'value': value[i],
                'timestamp': DateTime.now()
                    .subtract(Duration(hours: logs.length + 1))
                    .toIso8601String(),
              });
            }
          }
        }
      }
    });
    
    DateTime now = DateTime.now();
    List<int> payload = [now.year - 2000, now.month, now.day];
    
    Uint8List packet = _buildPacket(CMD_GET_SPO2_LOG, payload);
    await _writeChar!.write(packet.toList());
    
    await completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () {
        subscription?.cancel();
      },
    );
    
    return logs;
  }

  /// Ottiene i passi di oggi
  Future<int?> getSteps() async {
    final response = await _sendCommand(CMD_GET_STEPS);
    
    if (response != null && response.length > 4) {
      // I passi sono su 2-3 byte
      int steps = response[1] + (response[2] << 8);
      if (response.length > 3) {
        steps += (response[3] << 16);
      }
      return steps;
    }
    return null;
  }

  /// Ottiene dati sonno
  Future<Map<String, int>?> getSleepData() async {
    final response = await _sendCommand(
      CMD_GET_SLEEP_LOG,
      timeout: const Duration(seconds: 10),
    );
    
    if (response != null && response.length > 6) {
      return {
        'deep_minutes': response[1] + (response[2] << 8),
        'light_minutes': response[3] + (response[4] << 8),
        'awake_minutes': response[5] + (response[6] << 8),
      };
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  bool get isConnected => _isConnected;
  String? get deviceName => _deviceName;
  String? get firmwareVersion => _firmwareVersion;
  BluetoothDevice? get device => _device;

  /// Pulizia risorse
  void dispose() {
    _notifySubscription?.cancel();
    _responseController.close();
  }
}
