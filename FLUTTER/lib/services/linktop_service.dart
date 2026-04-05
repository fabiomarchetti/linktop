// lib/services/linktop_service.dart
// Servizio BLE per dispositivi LINKTOP HC02/HC03/HC04
// Porting del protocollo da app/dashboard/health-monitor/page.tsx

import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

class LinktopService {
  // UUID BLE LINKTOP
  static const String SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
  static const String CHAR_WRITE = '0000fff1-0000-1000-8000-00805f9b34fb';
  static const String CHAR_NOTIFY = '0000fff4-0000-1000-8000-00805f9b34fb';

  // Codici misurazione
  static const int MEASURE_BP = 1;
  static const int MEASURE_TEMP = 2;
  static const int MEASURE_SPO2 = 4;
  static const int MEASURE_ECG = 5;

  // Response type codes
  static const int RESP_BP = 0x81;
  static const int RESP_TEMP = 0x82;
  static const int RESP_SPO2 = 0x84;
  static const int RESP_BATTERY = 0x87;

  // Durata misurazione SpO2 (secondi)
  static const int MEASUREMENT_DURATION_SEC = 15;

  // Stato connessione
  BluetoothDevice? _device;
  BluetoothCharacteristic? _writeChar;
  BluetoothCharacteristic? _notifyChar;
  StreamSubscription? _notifySubscription;
  bool _isConnected = false;
  String? _deviceName;

  // Buffer per packet fragmentation
  List<int> _packetBuffer = [];
  int _expectedPacketLength = 0;

  // PPG samples per SpO2/HR
  final List<int> _ppgRed = [];
  final List<int> _ppgIr = [];

  // Finali aggregate
  List<int> _finalSpo2 = [];
  List<int> _finalHr = [];
  List<int> _spo2History = [];
  bool _spo2MeasurementDone = true;

  // Stream di eventi
  final _eventController = StreamController<LinktopEvent>.broadcast();
  Stream<LinktopEvent> get events => _eventController.stream;

  bool get isConnected => _isConnected;
  String? get deviceName => _deviceName;

  // ═══════════════════════════════════════════════════════════════
  // SCAN & CONNECT
  // ═══════════════════════════════════════════════════════════════

  /// Scansiona dispositivi LINKTOP (nome che inizia con HC0)
  /// Ritorna appena trova il primo dispositivo compatibile.
  Future<List<ScanResult>> scanForDevices({
    Duration timeout = const Duration(seconds: 10),
  }) async {
    if (await FlutterBluePlus.adapterState.first != BluetoothAdapterState.on) {
      throw Exception('Bluetooth non attivo');
    }

    final completer = Completer<List<ScanResult>>();
    final found = <ScanResult>[];
    StreamSubscription? sub;

    sub = FlutterBluePlus.scanResults.listen((results) {
      for (final r in results) {
        final name = r.device.platformName.toUpperCase();
        final advName = r.advertisementData.advName.toUpperCase();
        print('[LINKTOP] Scoperto: "${r.device.platformName}" / advName="${r.advertisementData.advName}" RSSI=${r.rssi}');
        if (name.startsWith('HC0') || advName.startsWith('HC0')) {
          if (!found.any((d) => d.device.remoteId == r.device.remoteId)) {
            found.add(r);
            if (!completer.isCompleted) {
              completer.complete(found);
            }
          }
        }
      }
    });

    await FlutterBluePlus.startScan(timeout: timeout);

    // Aspetta il primo dispositivo trovato o il timeout
    final result = await completer.future.timeout(
      timeout,
      onTimeout: () => found,
    );

    await sub.cancel();
    await FlutterBluePlus.stopScan();
    return result;
  }

  /// Connetti a un dispositivo LINKTOP
  Future<bool> connect(BluetoothDevice device) async {
    try {
      print('[LINKTOP] Tentativo connessione a ${device.platformName} (${device.remoteId})');
      await device.connect(timeout: const Duration(seconds: 15), autoConnect: false);
      print('[LINKTOP] Connesso, scopro servizi...');
      _device = device;
      _deviceName = device.platformName;

      final services = await device.discoverServices();
      print('[LINKTOP] Trovati ${services.length} servizi');

      // Cerca servizio LINKTOP: fff0, ff27, o qualsiasi "fff"/"ff"
      BluetoothService? linktopService;
      for (final service in services) {
        final svcUuid = service.uuid.toString().toLowerCase();
        print('[LINKTOP] Service: $svcUuid');
        if (svcUuid.contains('fff0') ||
            svcUuid.contains('ff27') ||
            svcUuid.startsWith('0000fff') ||
            svcUuid.startsWith('0000ff27')) {
          linktopService = service;
          print('[LINKTOP] Servizio LINKTOP selezionato: $svcUuid');
          break;
        }
      }

      // Fallback: primo servizio non standard
      if (linktopService == null) {
        for (final service in services) {
          final svcUuid = service.uuid.toString().toLowerCase();
          if (!svcUuid.contains('1800') &&
              !svcUuid.contains('1801') &&
              !svcUuid.contains('180a') &&
              !svcUuid.contains('180f')) {
            linktopService = service;
            print('[LINKTOP] Servizio LINKTOP (fallback): $svcUuid');
            break;
          }
        }
      }

      if (linktopService == null) {
        print('[LINKTOP] ERRORE: nessun servizio LINKTOP trovato');
        return false;
      }

      // Cerca caratteristiche per proprieta' (notify e write)
      for (final c in linktopService.characteristics) {
        final uuid = c.uuid.toString().toLowerCase();
        final props = c.properties;
        print('[LINKTOP]   Char: $uuid write=${props.write} wwr=${props.writeWithoutResponse} notify=${props.notify} indicate=${props.indicate}');

        if (_notifyChar == null && (props.notify || props.indicate)) {
          _notifyChar = c;
          await c.setNotifyValue(true);
          _notifySubscription = c.onValueReceived.listen(_handleNotification);
          print('[LINKTOP]   -> NOTIFY assegnato: $uuid');
        }
        if (_writeChar == null && (props.write || props.writeWithoutResponse)) {
          _writeChar = c;
          print('[LINKTOP]   -> WRITE assegnato: $uuid');
        }
      }

      _isConnected = _writeChar != null && _notifyChar != null;
      print('[LINKTOP] Connessione completata: isConnected=$_isConnected, write=${_writeChar != null}, notify=${_notifyChar != null}');
      return _isConnected;
    } catch (e, stack) {
      print('[LINKTOP] Errore connessione: $e');
      print('[LINKTOP] Stack: $stack');
      _isConnected = false;
      return false;
    }
  }

  /// Disconnetti
  Future<void> disconnect() async {
    await _notifySubscription?.cancel();
    await _device?.disconnect();
    _device = null;
    _writeChar = null;
    _notifyChar = null;
    _isConnected = false;
    _packetBuffer = [];
    _ppgRed.clear();
    _ppgIr.clear();
  }

  // ═══════════════════════════════════════════════════════════════
  // PACKET BUILDER
  // ═══════════════════════════════════════════════════════════════

  /// Costruisce un comando con checksum1 (XOR) e checksum2 (CRC16)
  Uint8List _buildCommand(int measureCode, List<int> payload) {
    final cmd = Uint8List(9 + payload.length);
    cmd[0] = 0x01;
    cmd[1] = payload.length & 0xFF;
    cmd[2] = (payload.length >> 8) & 0xFF;
    cmd[3] = 0x04;
    cmd[4] = measureCode;

    // Checksum1: XOR dei primi 5 byte
    int checksum1 = 0;
    for (int i = 0; i < 5; i++) {
      checksum1 ^= cmd[i];
    }
    cmd[5] = checksum1;

    // Payload
    for (int i = 0; i < payload.length; i++) {
      cmd[6 + i] = payload[i];
    }

    // Checksum2: CRC16 polynomial
    int checksum2 = 0xFFFF;
    for (int i = 0; i < 6 + payload.length; i++) {
      checksum2 = (((((checksum2 << 8) | ((checksum2 >> 8) & 0xFF)) & 0xFFFF) ^ cmd[i]) & 0xFFFF);
      final temp = (checksum2 ^ ((checksum2 & 0xFF) >> 4)) & 0xFFFF;
      final temp2 = (temp ^ ((temp << 8) << 4)) & 0xFFFF;
      checksum2 = (temp2 ^ (((temp2 & 0xFF) << 4) << 1)) & 0xFFFF;
    }

    final checksumPos = 6 + payload.length;
    cmd[checksumPos] = checksum2 & 0xFF;
    cmd[checksumPos + 1] = (checksum2 >> 8) & 0xFF;
    cmd[checksumPos + 2] = 0xFF;

    return cmd;
  }

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICATION HANDLER
  // ═══════════════════════════════════════════════════════════════

  void _handleNotification(List<int> chunk) {
    // Inizio nuovo pacchetto
    if (_packetBuffer.isEmpty) {
      if (chunk.length < 6 || (chunk[0] != 0x02 && chunk[0] != 0x01)) {
        return;
      }
      final payloadLength = chunk[1] | (chunk[2] << 8);
      _expectedPacketLength = payloadLength + 9;
    }

    _packetBuffer.addAll(chunk);

    if (_packetBuffer.length < _expectedPacketLength) {
      return;
    }

    final data = _packetBuffer.sublist(0, _expectedPacketLength);
    _packetBuffer = [];
    _expectedPacketLength = 0;

    final responseType = data[4];

    if (responseType == 0x10) {
      // ACK comando
      return;
    }

    if (responseType == RESP_SPO2) {
      _handleSpO2Response(data);
    } else if (responseType == RESP_TEMP) {
      _handleTempResponse(data);
    } else if (responseType == RESP_BATTERY) {
      _handleBatteryResponse(data);
    }
  }

  void _handleSpO2Response(List<int> data) {
    // Ignora risposte se la misurazione e' gia' terminata
    if (_spo2MeasurementDone) return;
    final payloadStart = 6;
    final payloadEnd = data.length - 3;
    final payload = data.sublist(payloadStart, payloadEnd);

    for (int i = 0; i + 5 < payload.length; i += 6) {
      final red1 = (payload[i] << 16) | (payload[i + 1] << 8) | payload[i + 2];
      final ir1 = (payload[i + 3] << 16) | (payload[i + 4] << 8) | payload[i + 5];

      // Swap: red=ir1, ir=red1 (come nel web)
      _ppgRed.add(ir1);
      _ppgIr.add(red1);

      if (_ppgRed.length > 200) {
        _ppgRed.removeAt(0);
        _ppgIr.removeAt(0);
      }
    }

    if (_ppgRed.length >= 100) {
      final result = _calculateVitals();
      if (result != null) {
        final spo2 = result['spo2']!;
        final hr = result['hr']!;

        if (spo2 >= 90 && spo2 <= 100) {
          _finalSpo2.add(spo2);
          if (hr > 0) _finalHr.add(hr);
          _eventController.add(LinktopEvent.progress(
            samplesCount: _finalSpo2.length,
          ));
        }
      }
    }
  }

  void _handleTempResponse(List<int> data) {
    const payloadStart = 6;
    if (data.length < payloadStart + 4) return;

    final btRaw = data[payloadStart] | (data[payloadStart + 1] << 8);
    final etRaw = data[payloadStart + 2] | (data[payloadStart + 3] << 8);

    final bt = (btRaw * 0.02) - 273.15;
    final et = (etRaw * 0.02) - 273.15;

    double finalTemp = bt;
    final tempDiff = bt - et;
    if (tempDiff > 5) {
      finalTemp = bt + (tempDiff * 0.05);
    }

    if (finalTemp > 30 && finalTemp < 45) {
      _eventController.add(LinktopEvent.temperature(
        temperature: finalTemp,
        envTemperature: et,
      ));
    }
  }

  void _handleBatteryResponse(List<int> data) {
    const payloadStart = 6;
    if (data.length < payloadStart + 1) return;
    final level = data[payloadStart];
    if (level >= 0 && level <= 100) {
      _eventController.add(LinktopEvent.battery(level: level));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CALCOLO HR e SpO2 DA PPG
  // ═══════════════════════════════════════════════════════════════

  Map<String, int>? _calculateVitals() {
    if (_ppgRed.length < 100 || _ppgIr.length < 100) return null;

    final irSamples = _ppgIr.length > 150
        ? _ppgIr.sublist(_ppgIr.length - 150)
        : List<int>.from(_ppgIr);

    final irMean = irSamples.reduce((a, b) => a + b) / irSamples.length;
    final irVar = irSamples
            .map((v) => math.pow(v - irMean, 2).toDouble())
            .reduce((a, b) => a + b) /
        irSamples.length;
    final irStd = math.sqrt(irVar);

    final threshold = irMean + (irStd * 0.5);
    int peaks = 0;
    int lastPeak = -50;

    for (int i = 2; i < irSamples.length - 2; i++) {
      final isLocalMax = irSamples[i] > threshold &&
          irSamples[i] > irSamples[i - 1] &&
          irSamples[i] > irSamples[i - 2] &&
          irSamples[i] >= irSamples[i + 1] &&
          irSamples[i] > irSamples[i + 2] &&
          i - lastPeak > 50;
      if (isLocalMax) {
        peaks++;
        lastPeak = i;
      }
    }

    final durationSec = irSamples.length / 125;
    int hr = ((peaks / durationSec) * 60).round();
    if (hr > 115 && hr < 160) hr = (hr / 2).round();
    hr = (hr * 0.64).round();

    // SpO2
    final redSamples = _ppgRed.length > 150
        ? _ppgRed.sublist(_ppgRed.length - 150)
        : List<int>.from(_ppgRed);

    final redMean = redSamples.reduce((a, b) => a + b) / redSamples.length;
    final redMax = redSamples.reduce(math.max);
    final redMin = redSamples.reduce(math.min);
    final acRed = (redMax - redMin) / 2;
    final dcRed = redMean;

    final irMax = irSamples.reduce(math.max);
    final irMin = irSamples.reduce(math.min);
    final acIr = (irMax - irMin) / 2;
    final dcIr = irMean;

    if (dcRed > 0 && dcIr > 0 && acRed > 0 && acIr > 0) {
      final R = (acRed / dcRed) / (acIr / dcIr);

      final values = <int>[
        (70 + 28 * R).round(),
        ((110 - 25 * R).round()) + 11,
        (97 + (1 - R) * 20).round(),
        (102 - (R - 0.8) * 10).round(),
      ];
      values.sort();
      int rawSpo2 = values[values.length ~/ 2];

      _spo2History.add(rawSpo2);
      if (_spo2History.length > 5) _spo2History.removeAt(0);
      int avgSpo2 = (_spo2History.reduce((a, b) => a + b) / _spo2History.length).round();

      // Offset di calibrazione (default +4 come web)
      int spo2 = avgSpo2 + 4;
      spo2 = spo2.clamp(90, 100);

      final validHr = (hr >= 40 && hr <= 150) ? hr : 0;

      return {'hr': validHr, 'spo2': spo2};
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // COMANDI PUBBLICI
  // ═══════════════════════════════════════════════════════════════

  /// Avvia misurazione SpO2 + HR (15 secondi)
  /// Ritorna {'spo2': X, 'hr': Y} oppure null se fallisce
  Future<Map<String, int>?> measureSpO2AndHR() async {
    if (!_isConnected || _writeChar == null) return null;

    // Reset
    _ppgRed.clear();
    _ppgIr.clear();
    _finalSpo2 = [];
    _finalHr = [];
    _spo2History = [];
    _spo2MeasurementDone = false;

    // Invia comando con payload [0x00]
    final cmd = _buildCommand(MEASURE_SPO2, [0x00]);
    await _writeChar!.write(cmd.toList(), withoutResponse: false);

    // Aspetta 15 secondi raccogliendo dati
    await Future.delayed(const Duration(seconds: MEASUREMENT_DURATION_SEC));

    // Marca la misurazione come terminata: le risposte successive vengono ignorate
    _spo2MeasurementDone = true;

    if (_finalSpo2.isEmpty) return null;

    final finalSpo2 = _median(_finalSpo2);
    final finalHr = _finalHr.isNotEmpty ? _median(_finalHr) : 0;

    return {'spo2': finalSpo2, 'hr': finalHr};
  }

  /// Avvia misurazione temperatura
  /// Il risultato arriva via stream events
  Future<void> measureTemperature() async {
    if (!_isConnected || _writeChar == null) return;
    final cmd = _buildCommand(MEASURE_TEMP, [0x00]);
    await _writeChar!.write(cmd.toList(), withoutResponse: false);
  }

  /// Invia comando STOP
  Future<void> stopMeasurement() async {
    if (!_isConnected || _writeChar == null) return;
    final cmd = _buildCommand(MEASURE_SPO2, [0x01]);
    await _writeChar!.write(cmd.toList(), withoutResponse: false);
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════

  int _median(List<int> values) {
    final sorted = List<int>.from(values)..sort();
    return sorted[sorted.length ~/ 2];
  }

  void dispose() {
    _notifySubscription?.cancel();
    _eventController.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTI STREAM
// ═══════════════════════════════════════════════════════════════════════════

class LinktopEvent {
  final LinktopEventType type;
  final int? samplesCount;
  final double? temperature;
  final double? envTemperature;
  final int? level;

  LinktopEvent._({
    required this.type,
    this.samplesCount,
    this.temperature,
    this.envTemperature,
    this.level,
  });

  factory LinktopEvent.progress({required int samplesCount}) =>
      LinktopEvent._(type: LinktopEventType.progress, samplesCount: samplesCount);

  factory LinktopEvent.temperature({
    required double temperature,
    required double envTemperature,
  }) =>
      LinktopEvent._(
        type: LinktopEventType.temperature,
        temperature: temperature,
        envTemperature: envTemperature,
      );

  factory LinktopEvent.battery({required int level}) =>
      LinktopEvent._(type: LinktopEventType.battery, level: level);
}

enum LinktopEventType { progress, temperature, battery }
