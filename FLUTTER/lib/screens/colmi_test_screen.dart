// lib/screens/colmi_test_screen.dart
// Schermo di test per anello Colmi R09

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import '../services/colmi_service.dart';

class ColmiTestScreen extends StatefulWidget {
  const ColmiTestScreen({super.key});

  @override
  State<ColmiTestScreen> createState() => _ColmiTestScreenState();
}

class _ColmiTestScreenState extends State<ColmiTestScreen> {
  final ColmiService _colmi = ColmiService();
  StreamSubscription? _eventSub;

  bool _scanning = false;
  bool _connecting = false;
  String _status = 'Pronto';
  int? _battery;
  int? _hr;
  int? _spo2;
  bool _measuringHr = false;
  bool _measuringSpo2 = false;
  final List<String> _log = [];

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

  void _addLog(String msg) {
    final time = TimeOfDay.now().format(context);
    setState(() {
      _log.insert(0, '[$time] $msg');
      if (_log.length > 50) _log.removeLast();
    });
  }

  void _onEvent(ColmiEvent event) {
    switch (event.type) {
      case ColmiEventType.battery:
        setState(() => _battery = event.level);
        _addLog('🔋 Batteria: ${event.level}%');
        break;
      case ColmiEventType.heartRate:
        setState(() => _hr = event.hr);
        _addLog('❤️ HR: ${event.hr} BPM');
        break;
      case ColmiEventType.spO2:
        setState(() => _spo2 = event.spo2);
        _addLog('💨 SpO2: ${event.spo2}%');
        break;
      case ColmiEventType.temperature:
        _addLog('🌡️ Temp: ${event.temperature?.toStringAsFixed(1)}°C');
        break;
      case ColmiEventType.error:
        _addLog('⚠️ Errore: ${event.errorMessage}');
        break;
      case ColmiEventType.rawNotify:
        _addLog('📡 ${event.errorMessage}');
        break;
    }
  }

  Future<void> _scan() async {
    setState(() {
      _scanning = true;
      _status = 'Ricerca anello...';
    });
    _addLog('Cerco anello (accoppiati + scansione)...');

    try {
      final device = await _colmi.findDevice(timeout: const Duration(seconds: 10));
      if (device == null) {
        setState(() => _status = 'Nessun anello trovato');
        _addLog('Nessun dispositivo R09/CITYSPORTS trovato');
        return;
      }

      setState(() => _status = 'Trovato: ${device.platformName}');
      _addLog('Trovato: ${device.platformName}');
      await _connectTo(device);
    } catch (e) {
      setState(() => _status = 'Errore: $e');
      _addLog('Errore ricerca: $e');
    } finally {
      setState(() => _scanning = false);
    }
  }

  Future<void> _connectTo(BluetoothDevice device) async {
    setState(() {
      _connecting = true;
      _status = 'Connessione...';
    });
    _addLog('Connessione a ${device.platformName}...');

    final ok = await _colmi.connect(device);
    setState(() {
      _connecting = false;
      _status = ok ? 'Connesso a ${device.platformName}' : 'Connessione fallita';
    });
    _addLog(ok ? '✅ Connesso!' : '❌ Connessione fallita');
  }

  Future<void> _disconnect() async {
    await _colmi.disconnect();
    setState(() {
      _status = 'Disconnesso';
      _battery = null;
      _hr = null;
      _spo2 = null;
      _measuringHr = false;
      _measuringSpo2 = false;
    });
    _addLog('Disconnesso');
  }

  Future<void> _toggleHr() async {
    if (_measuringHr) {
      await _colmi.stopHeartRate();
      setState(() => _measuringHr = false);
      _addLog('Stop misurazione HR');
    } else {
      await _colmi.startHeartRate();
      setState(() => _measuringHr = true);
      _addLog('Avvio misurazione HR...');
    }
  }

  Future<void> _toggleSpO2() async {
    if (_measuringSpo2) {
      await _colmi.stopSpO2();
      setState(() => _measuringSpo2 = false);
      _addLog('Stop misurazione SpO2');
    } else {
      await _colmi.startSpO2();
      setState(() => _measuringSpo2 = true);
      _addLog('Avvio misurazione SpO2...');
    }
  }

  @override
  Widget build(BuildContext context) {
    final connected = _colmi.isConnected;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Test Anello Colmi R09'),
        backgroundColor: Colors.deepPurple,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Status bar
          Container(
            width: double.infinity,
            color: connected ? Colors.green[700] : Colors.grey[700],
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text(
              _status,
              style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ),

          // Metriche
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _metricCard('🔋 Batteria', _battery != null ? '$_battery%' : '--'),
                const SizedBox(width: 12),
                _metricCard('❤️ HR', _hr != null ? '$_hr BPM' : '--'),
                const SizedBox(width: 12),
                _metricCard('💨 SpO2', _spo2 != null ? '$_spo2%' : '--'),
              ],
            ),
          ),

          // Bottoni
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                if (!connected) ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: (_scanning || _connecting) ? null : _scan,
                      icon: (_scanning || _connecting)
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.bluetooth_searching),
                      label: Text(_scanning ? 'Scansione...' : _connecting ? 'Connessione...' : 'Cerca e Connetti'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.deepPurple,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ] else ...[
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _toggleHr,
                          icon: Icon(_measuringHr ? Icons.stop : Icons.favorite),
                          label: Text(_measuringHr ? 'Stop HR' : 'Misura HR'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _measuringHr ? Colors.red : Colors.pink[700],
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _toggleSpO2,
                          icon: Icon(_measuringSpo2 ? Icons.stop : Icons.air),
                          label: Text(_measuringSpo2 ? 'Stop SpO2' : 'Misura SpO2'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _measuringSpo2 ? Colors.red : Colors.blue[700],
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _colmi.readBattery,
                          icon: const Icon(Icons.battery_charging_full),
                          label: const Text('Batteria'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green[700],
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _disconnect,
                          icon: const Icon(Icons.bluetooth_disabled),
                          label: const Text('Disconnetti'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.grey[700],
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const Divider(height: 24),

          // Log
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Log comunicazione BLE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                TextButton(
                  onPressed: () => setState(() => _log.clear()),
                  child: const Text('Pulisci'),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _log.length,
              itemBuilder: (ctx, i) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  _log[i],
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricCard(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
