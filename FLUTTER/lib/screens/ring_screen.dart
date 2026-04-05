// lib/screens/ring_screen.dart
// Schermata anello Colmi con valori HR/SpO2 e stato connessione

import 'package:flutter/material.dart';
import '../services/colmi_ring_service.dart';

class RingScreen extends StatefulWidget {
  const RingScreen({super.key});

  @override
  State<RingScreen> createState() => _RingScreenState();
}

class _RingScreenState extends State<RingScreen> {
  final ColmiRingService _ringService = ColmiRingService();
  
  bool _isConnected = false;
  bool _isScanning = false;
  bool _isMeasuring = false;
  
  String? _deviceName;
  int? _batteryLevel;
  int? _lastHR;
  int? _lastSpO2;
  int? _steps;
  
  DateTime? _lastSync;

  @override
  void initState() {
    super.initState();
    _checkConnection();
  }

  Future<void> _checkConnection() async {
    setState(() {
      _isConnected = _ringService.isConnected;
      _deviceName = _ringService.deviceName;
    });
    
    if (_isConnected) {
      await _refreshData();
    }
  }

  Future<void> _scanAndConnect() async {
    setState(() {
      _isScanning = true;
    });
    
    try {
      final rings = await _ringService.scanForRings();
      
      if (rings.isEmpty) {
        _showMessage('Nessun anello trovato');
      } else {
        final connected = await _ringService.connect(rings.first.device);
        
        if (connected) {
          setState(() {
            _isConnected = true;
            _deviceName = rings.first.device.platformName;
          });
          await _refreshData();
          _showMessage('Anello connesso!');
        } else {
          _showMessage('Connessione fallita');
        }
      }
    } catch (e) {
      _showMessage('Errore: $e');
    } finally {
      setState(() {
        _isScanning = false;
      });
    }
  }

  Future<void> _refreshData() async {
    if (!_isConnected) return;
    
    final battery = await _ringService.getBatteryLevel();
    final steps = await _ringService.getSteps();
    
    setState(() {
      _batteryLevel = battery;
      _steps = steps;
      _lastSync = DateTime.now();
    });
  }

  Future<void> _measureNow() async {
    if (!_isConnected) {
      _showMessage('Anello non connesso');
      return;
    }
    
    setState(() {
      _isMeasuring = true;
    });
    
    try {
      // Misura SpO2 (include anche HR)
      final result = await _ringService.measureSpO2RealTime();
      
      if (result != null) {
        setState(() {
          _lastSpO2 = result['spo2'];
          _lastHR = result['hr'];
        });
        _showMessage('Misura completata!');
      } else {
        _showMessage('Misura fallita, riprova');
      }
    } catch (e) {
      _showMessage('Errore: $e');
    } finally {
      setState(() {
        _isMeasuring = false;
      });
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontSize: 18)),
        duration: const Duration(seconds: 2),
      ),
    );
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
            // ═══════════════════════════════════════════════════
            // STATO CONNESSIONE
            // ═══════════════════════════════════════════════════
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
                  // Icona anello
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _isConnected ? Colors.green : Colors.grey,
                      shape: BoxShape.circle,
                    ),
                    child: const Text('💍', style: TextStyle(fontSize: 40)),
                  ),
                  const SizedBox(width: 16),
                  // Info
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
                          Text(
                            _deviceName!,
                            style: const TextStyle(fontSize: 18, color: Colors.grey),
                          ),
                        if (_batteryLevel != null)
                          Row(
                            children: [
                              Icon(
                                _batteryLevel! > 20 
                                    ? Icons.battery_full 
                                    : Icons.battery_alert,
                                color: _batteryLevel! > 20 ? Colors.green : Colors.red,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Batteria: $_batteryLevel%',
                                style: const TextStyle(fontSize: 18),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 20),
            
            // ═══════════════════════════════════════════════════
            // BOTTONE CONNETTI (se non connesso)
            // ═══════════════════════════════════════════════════
            if (!_isConnected)
              SizedBox(
                width: double.infinity,
                height: 80,
                child: ElevatedButton(
                  onPressed: _isScanning ? null : _scanAndConnect,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple,
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
                                color: Colors.white,
                                strokeWidth: 3,
                              ),
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
                            Text('CONNETTI ANELLO', style: TextStyle(fontSize: 22)),
                          ],
                        ),
                ),
              ),
            
            const SizedBox(height: 20),
            
            // ═══════════════════════════════════════════════════
            // VALORI MISURATI
            // ═══════════════════════════════════════════════════
            Row(
              children: [
                // SpO2
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
                // HR
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
            
            const SizedBox(height: 16),
            
            // Passi
            _buildValueCard(
              icon: Icons.directions_walk,
              label: 'PASSI OGGI',
              value: _steps != null ? '$_steps' : '--',
              color: Colors.green,
              isNormal: true,
              fullWidth: true,
            ),
            
            const SizedBox(height: 20),
            
            // Ultima sincronizzazione
            if (_lastSync != null)
              Text(
                'Ultimo aggiornamento: ${_formatTime(_lastSync!)}',
                style: const TextStyle(fontSize: 16, color: Colors.grey),
              ),
            
            const SizedBox(height: 20),
            
            // ═══════════════════════════════════════════════════
            // BOTTONE MISURA ORA
            // ═══════════════════════════════════════════════════
            if (_isConnected)
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
                      ? const Column(
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
                            SizedBox(height: 8),
                            Text(
                              'MISURA IN CORSO...',
                              style: TextStyle(fontSize: 20),
                            ),
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
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            
            const SizedBox(height: 16),
            
            // Bottone Aggiorna
            if (_isConnected)
              TextButton.icon(
                onPressed: _refreshData,
                icon: const Icon(Icons.refresh, size: 24),
                label: const Text('Aggiorna dati', style: TextStyle(fontSize: 18)),
              ),
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
    bool fullWidth = false,
  }) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: !isNormal ? Border.all(color: Colors.red, width: 3) : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 5,
          ),
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
                    style: const TextStyle(fontSize: 18, color: Colors.grey),
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

  @override
  void dispose() {
    _ringService.dispose();
    super.dispose();
  }
}
