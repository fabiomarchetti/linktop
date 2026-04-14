// lib/services/colmi_service.dart
// Servizio BLE per anello Colmi R09 (CITYSPORTS-Linker)
// Protocollo: Nordic UART, pacchetti 16 byte, XOR checksum

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:http/http.dart' as http;

class ColmiService {
  // UUID BLE Colmi R09
  static const String SERVICE_UUID = '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e';
  static const String CHAR_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write
  static const String CHAR_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify

  // Comandi (da decompilazione APK QRing / oudmon BLE SDK)
  static const int CMD_BATTERY       = 0x03; // BatteryRsp
  static const int CMD_START_MEASURE = 0x69; // StartHeartRateReq (AU_MMI_OUTPUT_INDICATION_3=105)
  static const int CMD_STOP_MEASURE  = 0x6A; // StopHeartRateReq (AU_MMI_MIC_SWITCH=106)
  static const int CMD_REALTIME_POLL = 0x1E; // RealTimeHeartRate cmd=30

  BluetoothDevice? _device;
  BluetoothCharacteristic? _rxChar; // write
  BluetoothCharacteristic? _txChar; // notify
  StreamSubscription? _notifySubscription;
  bool _isConnected = false;
  String? _deviceName;

  final _eventController = StreamController<ColmiEvent>.broadcast();
  Stream<ColmiEvent> get events => _eventController.stream;

  bool get isConnected => _isConnected;
  String? get deviceName => _deviceName;

  // ═══════════════════════════════════════════════════════════════
  // SCAN & CONNECT
  // ═══════════════════════════════════════════════════════════════

  /// Cerca l'anello Colmi: prima tra i dispositivi già accoppiati,
  /// poi tramite scansione BLE attiva.
  Future<BluetoothDevice?> findDevice({
    Duration timeout = const Duration(seconds: 10),
  }) async {
    if (await FlutterBluePlus.adapterState.first != BluetoothAdapterState.on) {
      throw Exception('Bluetooth non attivo');
    }

    // 1. Controlla dispositivi già accoppiati (bonded)
    final bonded = await FlutterBluePlus.bondedDevices;
    print('[COLMI] Dispositivi accoppiati: ${bonded.map((d) => d.platformName).join(', ')}');
    for (final d in bonded) {
      final name = d.platformName.toUpperCase();
      if (name.startsWith('R09') || name.contains('COLMI') || name.contains('CITYSPORTS')) {
        print('[COLMI] Trovato tra accoppiati: ${d.platformName}');
        return d;
      }
    }

    // 2. Scansione attiva
    final completer = Completer<BluetoothDevice?>();
    StreamSubscription? sub;

    sub = FlutterBluePlus.scanResults.listen((results) {
      for (final r in results) {
        final name = r.device.platformName.toUpperCase();
        final advName = r.advertisementData.advName.toUpperCase();
        print('[COLMI] Scoperto: "${r.device.platformName}" / advName="$advName" RSSI=${r.rssi}');
        if (name.startsWith('R09') || advName.startsWith('R09') ||
            name.contains('CITYSPORTS') || advName.contains('CITYSPORTS')) {
          if (!completer.isCompleted) {
            print('[COLMI] Trovato via scan: ${r.device.platformName}');
            completer.complete(r.device);
          }
        }
      }
    });

    await FlutterBluePlus.startScan(timeout: timeout);
    final device = await completer.future.timeout(timeout, onTimeout: () => null);
    await sub.cancel();
    await FlutterBluePlus.stopScan();
    return device;
  }

  Future<bool> connect(BluetoothDevice device, {int retries = 2}) async {
    for (int attempt = 1; attempt <= retries; attempt++) {
      final ok = await _tryConnect(device);
      if (ok) return true;
      if (attempt < retries) {
        print('[COLMI] Retry connessione (tentativo ${attempt + 1}/$retries)...');
        try { await device.disconnect(); } catch (_) {}
        await Future.delayed(const Duration(seconds: 2));
      }
    }
    return false;
  }

  Future<bool> _tryConnect(BluetoothDevice device) async {
    try {
      print('[COLMI] Connessione a ${device.platformName} (${device.remoteId})');
      await device.connect(timeout: const Duration(seconds: 15), autoConnect: false);
      _device = device;
      _deviceName = device.platformName;

      // Delay necessario su Android per evitare GATT ERROR 133
      await Future.delayed(const Duration(milliseconds: 1500));

      final services = await device.discoverServices();
      print('[COLMI] Trovati ${services.length} servizi');

      BluetoothService? mainService;
      for (final s in services) {
        final uuid = s.uuid.toString().toLowerCase();
        print('[COLMI] Service: $uuid');
        if (uuid.contains('6e40fff0')) {
          mainService = s;
          break;
        }
      }

      if (mainService == null) {
        print('[COLMI] ERRORE: servizio 6e40fff0 non trovato');
        return false;
      }

      for (final c in mainService.characteristics) {
        final uuid = c.uuid.toString().toLowerCase();
        final props = c.properties;
        print('[COLMI]   Char: $uuid notify=${props.notify} write=${props.write} wwr=${props.writeWithoutResponse}');

        if (_txChar == null && uuid.contains('6e400003') && props.notify) {
          _txChar = c;
          await c.setNotifyValue(true);
          _notifySubscription = c.onValueReceived.listen(_handleNotification);
          print('[COLMI]   -> TX (notify) assegnato');
        }
        if (_rxChar == null && uuid.contains('6e400002') &&
            (props.write || props.writeWithoutResponse)) {
          _rxChar = c;
          print('[COLMI]   -> RX (write) assegnato');
        }
      }

      _isConnected = _rxChar != null && _txChar != null;
      print('[COLMI] Connessione: isConnected=$_isConnected');

      if (_isConnected) {
        // Leggi subito la batteria
        await Future.delayed(const Duration(milliseconds: 500));
        await readBattery();
      }

      return _isConnected;
    } catch (e, stack) {
      print('[COLMI] Errore connessione: $e');
      print('[COLMI] Stack: $stack');
      _isConnected = false;
      _eventController.add(ColmiEvent.error(message: e.toString()));
      return false;
    }
  }

  Future<void> disconnect() async {
    _hrPollTimer?.cancel();
    _hrPollTimer = null;
    await stopHeartRate();
    await stopSpO2();
    await _notifySubscription?.cancel();
    await _device?.disconnect();
    _device = null;
    _rxChar = null;
    _txChar = null;
    _isConnected = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // PACKET BUILDER (16 byte, byte[15] = SOMMA byte[0..14] mod 256)
  // ═══════════════════════════════════════════════════════════════

  Uint8List _buildPacket(List<int> data) {
    final packet = Uint8List(16);
    for (int i = 0; i < data.length && i < 15; i++) {
      packet[i] = data[i];
    }
    int sum = 0;
    for (int i = 0; i < 15; i++) sum += packet[i];
    packet[15] = sum & 0xFF;
    return packet;
  }

  Future<void> _write(List<int> data) async {
    if (_rxChar == null) return;
    final packet = _buildPacket(data);
    final hex = packet.map((b) => b.toRadixString(16).padLeft(2, '0')).join(' ');
    print('[COLMI] WRITE: $hex');
    try {
      await _rxChar!.write(
        packet.toList(),
        withoutResponse: _rxChar!.properties.writeWithoutResponse,
      );
    } catch (e) {
      print('[COLMI] Errore write: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICATION HANDLER
  // ═══════════════════════════════════════════════════════════════

  void _handleNotification(List<int> data) {
    final hex = data.map((b) => b.toRadixString(16).padLeft(2, '0')).join(' ');
    print('[COLMI] NOTIFY (${data.length} byte): $hex');
    _eventController.add(ColmiEvent.rawNotify(message: 'RX(${data.length}): $hex'));

    if (data.isEmpty) return;
    final cmd = data[0];

    // Batteria: [0x03, livello%, ...]
    if (cmd == CMD_BATTERY && data.length >= 2) {
      final level = data[1];
      if (level >= 0 && level <= 100) {
        print('[COLMI] Batteria: $level%');
        _eventController.add(ColmiEvent.battery(level: level));
      }
      return;
    }

    // Risposta StartHeartRateReq [0x69, type, errCode, ...]
    // HR (type=1): valore a byte[6] → [0x69, 0x01, 0x00, 0x00, 0x00, 0x00, HR, 0x03, ...]
    // SpO2 (type=3): valore a byte[3] → [0x69, 0x03, 0x00, SpO2, 0x01, ...]
    if (cmd == CMD_START_MEASURE && data.length >= 4) {
      final type = data[1];
      final errCode = data[2];
      print('[COLMI] StartMeasure resp: type=$type errCode=$errCode value=${data[3]}');
      if (errCode == 0) {
        if (type == 1 && data.length >= 7) {
          final hr = data[6];
          if (hr > 20 && hr < 220) {
            _eventController.add(ColmiEvent.heartRate(hr: hr));
          }
        } else if (type == 3) {
          final spo2 = data[3];
          if (spo2 > 50 && spo2 <= 100) {
            _eventController.add(ColmiEvent.spO2(spo2: spo2));
          }
        }
      }
    }

    // Risposta RealTimeHeartRate [0x1E, hr_value, ...]
    if (cmd == CMD_REALTIME_POLL && data.length >= 2) {
      final hr = data[1];
      print('[COLMI] RealTimePoll HR: $hr');
      if (hr > 20 && hr < 250) {
        _eventController.add(ColmiEvent.heartRate(hr: hr));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMANDI PUBBLICI
  // ═══════════════════════════════════════════════════════════════

  Future<void> readBattery() async {
    await _write([CMD_BATTERY]);
  }

  // Timer per polling real-time HR
  Timer? _hrPollTimer;

  Future<void> startHeartRate() async {
    // 1) Invia comando start misurazione HR (type=1)
    await _write([CMD_START_MEASURE, 0x01, 0x00]);
    // 2) Polling real-time ogni secondo: RealTimeHeartRate(3)
    _hrPollTimer?.cancel();
    _hrPollTimer = Timer.periodic(const Duration(seconds: 1), (_) async {
      if (_isConnected) await _write([CMD_REALTIME_POLL, 0x03]);
    });
  }

  Future<void> stopHeartRate() async {
    _hrPollTimer?.cancel();
    _hrPollTimer = null;
    try { await _write([CMD_STOP_MEASURE, 0x01, 0x00, 0x00]); } catch (_) {}
  }

  Future<void> startSpO2() async {
    // Start misurazione SpO2 (type=3)
    await _write([CMD_START_MEASURE, 0x03, 0x25]);
  }

  Future<void> stopSpO2() async {
    try { await _write([CMD_STOP_MEASURE, 0x03, 0x00, 0x00]); } catch (_) {}
  }

  /// Misura HR + SpO2 e salva sul portale. Usato per misurazioni remote.
  /// Ritorna true se almeno un valore è stato salvato.
  Future<bool> measureAndSave({
    required String pazienteId,
    required String apiBase,
    required int commandId,
    required Future<void> Function(int, Map<String, dynamic>?, {String? error}) completeCommand,
  }) async {
    int? hr;
    int? spo2;

    try {
      // Connetti all'anello
      final device = await findDevice(timeout: const Duration(seconds: 15));
      if (device == null) {
        await completeCommand(commandId, null, error: 'Anello non trovato');
        return false;
      }

      final ok = await connect(device);
      if (!ok) {
        await completeCommand(commandId, null, error: 'Connessione fallita');
        return false;
      }

      // Ascolta eventi
      final sub = events.listen((event) {
        if (event.type == ColmiEventType.heartRate && event.hr != null) hr = event.hr;
        if (event.type == ColmiEventType.spO2 && event.spo2 != null) spo2 = event.spo2;
      });

      // Avvia HR (con polling)
      await startHeartRate();
      await Future.delayed(const Duration(seconds: 20));
      await stopHeartRate();

      // Avvia SpO2: calibrazione ~10 sec, aspetta fino a 35 sec senza riavviare
      await startSpO2();
      for (int i = 0; i < 35; i++) {
        await Future.delayed(const Duration(seconds: 1));
        if (spo2 != null) break;
      }
      await stopSpO2();

      await sub.cancel();
      await disconnect();

      if (hr == null && spo2 == null) {
        await completeCommand(commandId, null, error: 'Nessun dato rilevato');
        return false;
      }

      // Salva sul portale
      final url = Uri.parse('$apiBase/health-data');
      final body = <String, dynamic>{
        'paziente_id': int.tryParse(pazienteId) ?? pazienteId,
        'source': 'colmi',
        'measurement_type': 'health_monitor',
      };
      if (hr != null) body['heart_rate'] = hr;
      if (spo2 != null) body['spo2'] = spo2;

      await http.post(url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      await completeCommand(commandId, {'hr': hr, 'spo2': spo2});
      return true;
    } catch (e) {
      await completeCommand(commandId, null, error: e.toString());
      return false;
    }
  }

  void dispose() {
    _hrPollTimer?.cancel();
    _notifySubscription?.cancel();
    _eventController.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTI STREAM
// ═══════════════════════════════════════════════════════════════════════════

class ColmiEvent {
  final ColmiEventType type;
  final int? hr;
  final int? spo2;
  final int? level;
  final double? temperature;
  final String? errorMessage;

  ColmiEvent._({
    required this.type,
    this.hr,
    this.spo2,
    this.level,
    this.temperature,
    this.errorMessage,
  });

  factory ColmiEvent.heartRate({required int hr}) =>
      ColmiEvent._(type: ColmiEventType.heartRate, hr: hr);

  factory ColmiEvent.spO2({required int spo2}) =>
      ColmiEvent._(type: ColmiEventType.spO2, spo2: spo2);

  factory ColmiEvent.battery({required int level}) =>
      ColmiEvent._(type: ColmiEventType.battery, level: level);

  factory ColmiEvent.temperature({required double temperature}) =>
      ColmiEvent._(type: ColmiEventType.temperature, temperature: temperature);

  factory ColmiEvent.error({required String message}) =>
      ColmiEvent._(type: ColmiEventType.error, errorMessage: message);

  factory ColmiEvent.rawNotify({required String message}) =>
      ColmiEvent._(type: ColmiEventType.rawNotify, errorMessage: message);
}

enum ColmiEventType { heartRate, spO2, battery, temperature, error, rawNotify }
