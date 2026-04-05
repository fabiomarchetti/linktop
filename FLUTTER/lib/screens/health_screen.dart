// lib/screens/health_screen.dart
// Schermata salute per misurazione con dispositivi LINKTOP

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/linktop_service.dart';

class HealthScreen extends StatefulWidget {
  const HealthScreen({super.key});

  @override
  State<HealthScreen> createState() => _HealthScreenState();
}

class _HealthScreenState extends State<HealthScreen> {
  final LinktopService _linktop = LinktopService();

  bool _isConnected = false;
  bool _isScanning = false;
  bool _isMeasuring = false;
  String? _deviceName;
  String _status = 'Premi INIZIA MISURA per iniziare';

  // Ultimi valori
  int? _lastSpO2;
  int? _lastHR;
  double? _lastTemp;
  DateTime? _lastMeasurement;

  StreamSubscription? _eventSub;

  @override
  void initState() {
    super.initState();
    _eventSub = _linktop.events.listen(_onLinktopEvent);
  }

  @override
  void dispose() {
    _eventSub?.cancel();
    _linktop.disconnect();
    super.dispose();
  }

  void _onLinktopEvent(LinktopEvent event) {
    if (!mounted) return;
    switch (event.type) {
      case LinktopEventType.progress:
        // Mostra progress solo durante la misurazione attiva
        if (_isMeasuring) {
          setState(() {
            _status = 'Misurazione in corso... (${event.samplesCount} campioni)';
          });
        }
        break;
      case LinktopEventType.temperature:
        setState(() {
          _lastTemp = event.temperature;
        });
        break;
      case LinktopEventType.battery:
        break;
    }
  }

  Future<void> _scanAndConnect() async {
    setState(() {
      _isScanning = true;
      _status = 'Cerco dispositivo LINKTOP...';
    });

    try {
      final devices = await _linktop.scanForDevices();
      if (devices.isEmpty) {
        setState(() {
          _isScanning = false;
          _status = 'Nessun dispositivo trovato. Accendi il LINKTOP.';
        });
        return;
      }

      setState(() {
        _status = 'Connessione a ${devices.first.device.platformName}...';
      });

      final ok = await _linktop.connect(devices.first.device);
      setState(() {
        _isScanning = false;
        _isConnected = ok;
        _deviceName = _linktop.deviceName;
        _status = ok ? 'Connesso! Inizio misurazione...' : 'Connessione fallita';
      });
    } catch (e) {
      setState(() {
        _isScanning = false;
        _status = 'Errore: $e';
      });
    }
  }

  Future<void> _startMeasurement() async {
    if (!_isConnected) {
      await _scanAndConnect();
      if (!_isConnected) return;
    }

    setState(() {
      _isMeasuring = true;
      _status = 'Misurazione SpO2/HR (15 secondi)...';
      _lastSpO2 = null;
      _lastHR = null;
      _lastTemp = null;
    });

    try {
      final result = await _linktop.measureSpO2AndHR();
      if (result != null) {
        setState(() {
          _lastSpO2 = result['spo2'];
          _lastHR = result['hr'];
          _lastMeasurement = DateTime.now();
          _status = 'SpO2/HR completato!';
          _isMeasuring = false;
        });

        // Mostra popup per la temperatura
        if (mounted) {
          await _showTemperatureDialog();
        }

        // Salva su database (anche se temp non e' stata fatta)
        await _saveMeasurement();
      } else {
        setState(() {
          _status = 'Errore: nessun dato ricevuto. Riprova.';
          _isMeasuring = false;
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Errore misurazione: $e';
        _isMeasuring = false;
      });
    }
  }

  Future<void> _showTemperatureDialog() async {
    StreamSubscription? dialogSub;
    try {
      await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          // Aggiorna il dialog quando arriva una temperatura dal BLE
          dialogSub ??= _linktop.events.listen((event) {
            if (event.type == LinktopEventType.temperature) {
              setDialogState(() {});
            }
          });
          return AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.thermostat, color: Colors.orange, size: 36),
                SizedBox(width: 10),
                Expanded(
                  child: Text('TEMPERATURA', style: TextStyle(fontSize: 24)),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.face, size: 80, color: Colors.orange),
                const SizedBox(height: 16),
                const Text(
                  'Avvicina il dispositivo\nalla fronte',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Tienilo fermo a 2-3 cm dalla pelle',
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
                if (_lastTemp != null) ...[
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const Text('Rilevata:', style: TextStyle(fontSize: 16)),
                        Text(
                          '${_lastTemp!.toStringAsFixed(1)}°C',
                          style: const TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              SizedBox(
                width: double.infinity,
                height: 60,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await _linktop.measureTemperature();
                    // Aspetta aggiornamento valore
                    await Future.delayed(const Duration(seconds: 3));
                    setDialogState(() {});
                  },
                  icon: const Icon(Icons.play_arrow, size: 28),
                  label: const Text(
                    'MISURA TEMPERATURA',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  _lastTemp != null ? 'FATTO' : 'SALTA',
                  style: const TextStyle(fontSize: 18),
                ),
              ),
            ],
          );
        },
      ),
    );
    } finally {
      await dialogSub?.cancel();
    }
  }

  Future<void> _saveMeasurement() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final patientId = prefs.getString('patient_id');
      print('[SAVE] patient_id da prefs: $patientId');
      if (patientId == null) {
        setState(() => _status = 'Paziente non identificato');
        return;
      }
      final pazienteId = int.tryParse(patientId) ?? patientId;

      // Salva ciascuna misurazione come riga separata (vincolo chk_measurement_type)
      final url = Uri.parse('https://www.monitoraggiosalute.com/api/health-data');
      final headers = {'Content-Type': 'application/json'};
      int savedCount = 0;
      int totalCount = 0;

      Future<bool> postOne(Map<String, dynamic> body) async {
        totalCount++;
        print('[SAVE] POST body: $body');
        final r = await http.post(url, headers: headers, body: jsonEncode(body));
        print('[SAVE] Response ${r.statusCode}: ${r.body}');
        if (r.statusCode == 201) {
          savedCount++;
          return true;
        }
        return false;
      }

      if (_lastSpO2 != null) {
        await postOne({
          'paziente_id': pazienteId,
          'measurement_type': 'spo2',
          'spo2': _lastSpO2,
          if (_lastHR != null) 'heart_rate': _lastHR,
        });
      } else if (_lastHR != null) {
        await postOne({
          'paziente_id': pazienteId,
          'measurement_type': 'heart_rate',
          'heart_rate': _lastHR,
        });
      }

      if (_lastTemp != null) {
        await postOne({
          'paziente_id': pazienteId,
          'measurement_type': 'temperature',
          'temperature': _lastTemp,
        });
      }

      setState(() {
        _status = savedCount == totalCount
            ? 'Misurazione salvata sul portale'
            : 'Salvate $savedCount/$totalCount misurazioni';
      });
    } catch (e, stack) {
      print('[SAVE] Eccezione: $e');
      print('[SAVE] Stack: $stack');
      setState(() {
        _status = 'Errore invio: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('SALUTE', style: TextStyle(fontSize: 28)),
        centerTitle: true,
        backgroundColor: Colors.red,
        foregroundColor: Colors.white,
        toolbarHeight: 70,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, size: 32),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _isConnected ? Colors.green : Colors.grey,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _isConnected ? Icons.bluetooth_connected : Icons.bluetooth_disabled,
                  color: Colors.white,
                  size: 20,
                ),
                const SizedBox(width: 6),
                Text(
                  _isConnected ? 'OK' : 'OFF',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Status box
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: Colors.grey[300]!),
              ),
              child: Row(
                children: [
                  Icon(
                    _isMeasuring ? Icons.hourglass_top : Icons.info_outline,
                    color: _isConnected ? Colors.green : Colors.orange,
                    size: 28,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _status,
                      style: const TextStyle(fontSize: 16),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Griglia SpO2 + HR (principali, visibili)
            Row(
              children: [
                Expanded(
                  child: _buildParameterCard(
                    icon: Icons.air,
                    label: 'OSSIGENO',
                    value: _lastSpO2 != null ? '$_lastSpO2%' : '--',
                    color: Colors.blue,
                    isNormal: _lastSpO2 == null || _lastSpO2! >= 95,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildParameterCard(
                    icon: Icons.favorite,
                    label: 'BATTITO',
                    value: _lastHR != null ? '$_lastHR' : '--',
                    unit: 'bpm',
                    color: Colors.red,
                    isNormal: _lastHR == null || (_lastHR! >= 60 && _lastHR! <= 100),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            if (_lastMeasurement != null)
              Text(
                'Ultima misura: ${_formatTime(_lastMeasurement!)}',
                style: const TextStyle(fontSize: 16, color: Colors.grey),
              ),

            const SizedBox(height: 20),

            // Bottone MISURA
            SizedBox(
              width: double.infinity,
              height: 100,
              child: ElevatedButton(
                onPressed: _isMeasuring || _isScanning ? null : _startMeasurement,
                style: ElevatedButton.styleFrom(
                  backgroundColor: (_isMeasuring || _isScanning) ? Colors.grey : Colors.red,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(25),
                  ),
                ),
                child: _isMeasuring || _isScanning
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 30,
                            height: 30,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 3,
                            ),
                          ),
                          SizedBox(width: 16),
                          Text('ATTENDI...', style: TextStyle(fontSize: 24)),
                        ],
                      )
                    : const FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.play_arrow, size: 40),
                            SizedBox(width: 10),
                            Text(
                              'INIZIA MISURA',
                              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
              ),
            ),

            if (_deviceName != null) ...[
              const SizedBox(height: 12),
              Text(
                'Dispositivo: $_deviceName',
                style: const TextStyle(fontSize: 14, color: Colors.grey),
              ),
            ],

            // Bottone DISCONNETTI (visibile solo se connesso)
            if (_isConnected && !_isMeasuring) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 60,
                child: OutlinedButton.icon(
                  onPressed: _disconnect,
                  icon: const Icon(Icons.bluetooth_disabled, size: 24),
                  label: const Text(
                    'DISCONNETTI DISPOSITIVO',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red, width: 2),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _disconnect() async {
    try {
      await _linktop.stopMeasurement();
    } catch (_) {}
    await _linktop.disconnect();
    setState(() {
      _isConnected = false;
      _deviceName = null;
      _status = 'Dispositivo disconnesso';
    });
  }

  Widget _buildParameterCard({
    required IconData icon,
    required String label,
    required String value,
    String? unit,
    required Color color,
    required bool isNormal,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: !isNormal ? Border.all(color: Colors.red, width: 3) : null,
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 5),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, size: 36, color: color),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  color: isNormal ? Colors.black : Colors.red,
                ),
              ),
              if (unit != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6, left: 4),
                  child: Text(
                    unit,
                    style: const TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}
