// lib/screens/ring_screen.dart
// Schermata anello Colmi R09 — usa ColmiService (byte corretti da APK reverse engineering)

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/colmi_service.dart';

class RingScreen extends StatefulWidget {
  const RingScreen({super.key});

  @override
  State<RingScreen> createState() => _RingScreenState();
}

class _RingScreenState extends State<RingScreen> {
  final ColmiService _colmi = ColmiService();
  StreamSubscription? _eventSub;

  bool _isConnected = false;
  bool _isScanning = false;
  bool _isMeasuring = false;

  String? _deviceName;
  int? _batteryLevel;
  int? _lastHR;
  int? _lastSpO2;
  String _status = 'Premi CONNETTI ANELLO per iniziare';

  DateTime? _lastMeasurement;

  @override
  void initState() {
    super.initState();
    _eventSub = _colmi.events.listen(_onEvent);
  }

  @override
  void dispose() {
    _eventSub?.cancel();
    _colmi.dispose();
    super.dispose();
  }

  void _onEvent(ColmiEvent event) {
    if (!mounted) return;
    switch (event.type) {
      case ColmiEventType.battery:
        setState(() => _batteryLevel = event.level);
        break;
      case ColmiEventType.heartRate:
        if (event.hr != null) setState(() => _lastHR = event.hr);
        break;
      case ColmiEventType.spO2:
        if (event.spo2 != null) setState(() => _lastSpO2 = event.spo2);
        break;
      default:
        break;
    }
  }

  Future<void> _scanAndConnect() async {
    setState(() {
      _isScanning = true;
      _status = 'Cerco anello R09...';
      _lastHR = null;
      _lastSpO2 = null;
    });

    try {
      final device = await _colmi.findDevice(timeout: const Duration(seconds: 15));

      if (device == null) {
        setState(() {
          _isScanning = false;
          _status = 'Anello non trovato. Assicurati che sia indossato.';
        });
        return;
      }

      setState(() => _status = 'Connessione a ${device.platformName}...');

      final ok = await _colmi.connect(device);
      setState(() {
        _isScanning = false;
        _isConnected = ok;
        _deviceName = _colmi.deviceName;
        _status = ok
            ? 'Connesso! Premi MISURA ADESSO.'
            : 'Connessione fallita. Riprova.';
      });
    } catch (e) {
      setState(() {
        _isScanning = false;
        _status = 'Errore: $e';
      });
    }
  }

  Future<void> _measureNow() async {
    if (!_isConnected || !_colmi.isConnected) {
      setState(() {
        _isConnected = false;
        _status = 'Anello non connesso. Premi CONNETTI.';
      });
      return;
    }

    setState(() {
      _isMeasuring = true;
      _status = 'Misura battito (30 sec)...';
      _lastHR = null;
      _lastSpO2 = null;
    });

    int? hr;
    int? spo2;

    final sub = _colmi.events.listen((event) {
      if (event.type == ColmiEventType.heartRate && event.hr != null) {
        hr = event.hr;
        if (mounted) setState(() => _lastHR = hr);
      }
      if (event.type == ColmiEventType.spO2 && event.spo2 != null) {
        spo2 = event.spo2;
        if (mounted) setState(() => _lastSpO2 = spo2);
      }
    });

    try {
      await _colmi.startHeartRate();
      await Future.delayed(const Duration(seconds: 30));
      await _colmi.stopHeartRate();

      // Pausa tra HR e SpO2: il ring deve cambiare modalità sensore
      await Future.delayed(const Duration(seconds: 3));
      setState(() => _status = 'Misura ossigeno (30 sec)...');

      // SpO2: avvia una volta e aspetta fino a 35 sec (calibrazione ~10 sec)
      // NON riavviare il comando: ogni riavvio azzera la calibrazione del sensore
      await _colmi.startSpO2();
      for (int i = 0; i < 35; i++) {
        await Future.delayed(const Duration(seconds: 1));
        if (spo2 != null) break;
        if (mounted) {
          final remaining = 35 - i;
          setState(() => _status = 'Misura ossigeno... ($remaining sec)');
        }
      }
      await _colmi.stopSpO2();

      await sub.cancel();

      setState(() {
        _lastHR = hr;
        _lastSpO2 = spo2;
        _lastMeasurement = DateTime.now();
        _isMeasuring = false;
        _status = (hr != null || spo2 != null)
            ? 'Misura completata!'
            : 'Nessun dato. Indossa l\'anello bene e riprova.';
      });

      if (hr != null || spo2 != null) {
        await _saveMeasurement(hr: hr, spo2: spo2);
      }
    } catch (e) {
      await sub.cancel();
      setState(() {
        _isMeasuring = false;
        _status = 'Errore misura: $e';
      });
    }
  }

  Future<void> _saveMeasurement({int? hr, int? spo2}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final patientId = prefs.getString('patient_id');
      if (patientId == null) return;

      // measurement_type basato sui dati disponibili
      final String measureType = spo2 != null ? 'spo2' : 'heart_rate';
      final body = <String, dynamic>{
        'paziente_id': int.tryParse(patientId) ?? patientId,
        'source': 'colmi',
        'measurement_type': measureType,
      };
      if (hr != null) body['heart_rate'] = hr;
      if (spo2 != null) body['spo2'] = spo2;

      final r = await http.post(
        Uri.parse('https://www.monitoraggiosalute.com/api/health-data'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      setState(() {
        _status = (r.statusCode == 200 || r.statusCode == 201)
            ? 'Dati salvati sul portale!'
            : 'Misura OK (errore salvataggio ${r.statusCode})';
      });
    } catch (e) {
      setState(() => _status = 'Errore invio dati: $e');
    }
  }

  Future<void> _disconnect() async {
    await _colmi.disconnect();
    setState(() {
      _isConnected = false;
      _deviceName = null;
      _batteryLevel = null;
      _status = 'Disconnesso';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('ANELLO', style: TextStyle(fontSize: 28)),
        centerTitle: true,
        backgroundColor: Colors.purple,
        foregroundColor: Colors.white,
        toolbarHeight: 70,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, size: 32),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // ── STATO CONNESSIONE ──────────────────────────────
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _isConnected ? Colors.green[50] : Colors.red[50],
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _isConnected ? Colors.green : Colors.red,
                  width: 2,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _isConnected ? Colors.green : Colors.grey,
                      shape: BoxShape.circle,
                    ),
                    child: const Text('💍', style: TextStyle(fontSize: 40)),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isConnected ? 'CONNESSO' : 'NON CONNESSO',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: _isConnected ? Colors.green : Colors.red,
                          ),
                        ),
                        if (_deviceName != null)
                          Text(_deviceName!,
                              style: const TextStyle(fontSize: 16, color: Colors.grey)),
                        if (_batteryLevel != null)
                          Row(
                            children: [
                              Icon(
                                _batteryLevel! > 20
                                    ? Icons.battery_full
                                    : Icons.battery_alert,
                                color: _batteryLevel! > 20 ? Colors.green : Colors.red,
                                size: 20,
                              ),
                              const SizedBox(width: 4),
                              Text('Batteria: $_batteryLevel%',
                                  style: const TextStyle(fontSize: 16)),
                            ],
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── STATUS ─────────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[300]!),
              ),
              child: Row(
                children: [
                  Icon(
                    _isMeasuring ? Icons.hourglass_top : Icons.info_outline,
                    color: Colors.purple,
                    size: 24,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(_status, style: const TextStyle(fontSize: 15)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── VALORI ─────────────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: _buildValueCard(
                    icon: Icons.air,
                    label: 'OSSIGENO',
                    value: _lastSpO2 != null ? '$_lastSpO2%' : '--',
                    color: Colors.blue,
                    isNormal: _lastSpO2 == null || _lastSpO2! >= 95,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildValueCard(
                    icon: Icons.favorite,
                    label: 'BATTITO',
                    value: _lastHR != null ? '$_lastHR' : '--',
                    unit: 'bpm',
                    color: Colors.red,
                    isNormal: _lastHR == null || (_lastHR! >= 50 && _lastHR! <= 120),
                  ),
                ),
              ],
            ),

            if (_lastMeasurement != null) ...[
              const SizedBox(height: 12),
              Text(
                'Ultima misura: ${_formatTime(_lastMeasurement!)}',
                style: const TextStyle(fontSize: 15, color: Colors.grey),
              ),
            ],

            const SizedBox(height: 20),

            // ── BOTTONE CONNETTI ───────────────────────────────
            if (!_isConnected)
              SizedBox(
                width: double.infinity,
                height: 80,
                child: ElevatedButton(
                  onPressed: (_isScanning || _isMeasuring) ? null : _scanAndConnect,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: (_isScanning || _isMeasuring)
                        ? Colors.grey
                        : Colors.purple,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  child: _isScanning
                      ? const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 3),
                            ),
                            SizedBox(width: 12),
                            Text('CERCANDO...', style: TextStyle(fontSize: 22)),
                          ],
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.bluetooth_searching, size: 32),
                            SizedBox(width: 12),
                            Text('CONNETTI ANELLO',
                                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                          ],
                        ),
                ),
              ),

            // ── BOTTONE MISURA ─────────────────────────────────
            if (_isConnected) ...[
              SizedBox(
                width: double.infinity,
                height: 100,
                child: ElevatedButton(
                  onPressed: _isMeasuring ? null : _measureNow,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isMeasuring ? Colors.grey : Colors.purple,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: _isMeasuring
                      ? const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 30,
                              height: 30,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 3),
                            ),
                            SizedBox(width: 16),
                            Text('MISURA IN CORSO...',
                                style: TextStyle(fontSize: 22)),
                          ],
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.play_arrow, size: 40),
                            SizedBox(width: 10),
                            Text(
                              'MISURA ADESSO',
                              style: TextStyle(
                                  fontSize: 28, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                height: 56,
                child: OutlinedButton.icon(
                  onPressed: _isMeasuring ? null : _disconnect,
                  icon: const Icon(Icons.bluetooth_disabled),
                  label: const Text('DISCONNETTI',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.purple,
                    side: const BorderSide(color: Colors.purple, width: 2),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildValueCard({
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
          Text(label,
              style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey)),
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
                  child: Text(unit,
                      style: const TextStyle(fontSize: 16, color: Colors.grey)),
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
