// lib/main.dart
// App Monitoraggio Anziani - Modalità Kiosk/Launcher

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'package:battery_plus/battery_plus.dart';

import 'package:shared_preferences/shared_preferences.dart';

import 'screens/login_screen.dart';
import 'screens/phone_screen.dart';
import 'screens/health_screen.dart';
import 'screens/ring_screen.dart';
import 'screens/contacts_screen.dart';
import 'services/monitoring_service.dart';
import 'services/gps_service.dart';

// Singleton GPS service (condiviso in tutta l'app)
final gpsService = GpsService();

/// Richiede tutti i permessi necessari all'app
Future<void> _requestAllPermissions() async {
  // Permessi da richiedere all'avvio
  final permissions = [
    Permission.phone,              // Chiamate telefoniche
    Permission.location,           // GPS
    Permission.locationAlways,     // GPS in background
    Permission.bluetoothScan,      // Scansione BLE
    Permission.bluetoothConnect,   // Connessione BLE
    Permission.notification,       // Notifiche
    Permission.ignoreBatteryOptimizations, // Batteria
  ];

  for (final perm in permissions) {
    final status = await perm.status;
    if (!status.isGranted) {
      await perm.request();
    }
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Inizializza Supabase
  await Supabase.initialize(
    url: 'https://jgtaebnbwlydljbqkogc.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGFlYm5id2x5ZGxqYnFrb2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODQxNTQsImV4cCI6MjA4Mzk2MDE1NH0.5u5JLXwq9oMR_Ynwn0i3782V2JytwzgDdB5g99ibDBE',
  );
  
  // Inizializza foreground task
  initForegroundTask();

  // Richiedi tutti i permessi all'avvio
  await _requestAllPermissions();

  // Attiva Bluetooth automaticamente
  try {
    if (await FlutterBluePlus.isSupported) {
      final state = await FlutterBluePlus.adapterState.first;
      if (state != BluetoothAdapterState.on) {
        await FlutterBluePlus.turnOn();
      }
    }
  } catch (e) {
    print('Bluetooth auto-enable fallito: $e');
  }

  // Attiva GPS automaticamente (richiede all'utente di abilitarlo)
  try {
    final gpsEnabled = await Geolocator.isLocationServiceEnabled();
    if (!gpsEnabled) {
      await Geolocator.openLocationSettings();
    }
  } catch (e) {
    print('GPS check fallito: $e');
  }
  
  // Modalità Kiosk: nascondi barre di sistema
  await SystemChrome.setEnabledSystemUIMode(
    SystemUiMode.immersiveSticky,
    overlays: [], // Nasconde navigation bar e status bar
  );
  
  // Orientamento solo portrait (smartphone)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  
  runApp(const ElderlyMonitoringApp());
}

class ElderlyMonitoringApp extends StatelessWidget {
  const ElderlyMonitoringApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Assistenza Anziani',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        // Tema ad alto contrasto per anziani
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.light,
        ),
        // Font grande
        textTheme: const TextTheme(
          headlineLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
          headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
          bodyLarge: TextStyle(fontSize: 22),
          bodyMedium: TextStyle(fontSize: 20),
          labelLarge: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        ),
        // Bottoni grandi
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(double.infinity, 80),
            textStyle: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
        useMaterial3: true,
      ),
      home: const AppEntryPoint(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT: controlla se il paziente e' gia' registrato
// ═══════════════════════════════════════════════════════════════════════════

class AppEntryPoint extends StatefulWidget {
  const AppEntryPoint({super.key});

  @override
  State<AppEntryPoint> createState() => _AppEntryPointState();
}

class _AppEntryPointState extends State<AppEntryPoint> {
  bool _isLoading = true;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkLogin();
  }

  Future<void> _checkLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final patientId = prefs.getString('patient_id');

    setState(() {
      _isLoggedIn = patientId != null;
      _isLoading = false;
    });
  }

  void _onLoginSuccess() {
    setState(() {
      _isLoggedIn = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_isLoggedIn) {
      return const KioskHomeScreen();
    }

    return LoginScreen(onLoginSuccess: _onLoginSuccess);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHERMATA PRINCIPALE KIOSK
// ═══════════════════════════════════════════════════════════════════════════

class KioskHomeScreen extends StatefulWidget {
  const KioskHomeScreen({super.key});

  @override
  State<KioskHomeScreen> createState() => _KioskHomeScreenState();
}

class _KioskHomeScreenState extends State<KioskHomeScreen> with WidgetsBindingObserver {
  
  // Stato connessioni
  bool _ringConnected = false;
  bool _linktopConnected = false;
  int _batteryLevel = 100;
  String _currentTime = '';
  final Battery _battery = Battery();
  
  // Contatore per sblocco admin (tap 5 volte su orologio)
  int _adminTapCount = 0;
  DateTime? _lastAdminTap;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    
    // Mantieni schermo acceso
    WakelockPlus.enable();

    // Avvia monitoraggio in background
    _startMonitoringService();

    // Avvia tracking GPS (posizione periodica + listener comandi)
    gpsService.start();

    // Leggi batteria reale e aggiorna ogni minuto
    _updateBattery();

    // Aggiorna orologio
    _updateTime();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    WakelockPlus.disable();
    super.dispose();
  }

  // Impedisci uscita con tasto back
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // L'utente ha provato a uscire, riporta l'app in primo piano
      // (funziona solo se l'app è impostata come launcher)
    }
  }

  void _updateBattery() {
    _battery.batteryLevel.then((level) {
      if (mounted) setState(() => _batteryLevel = level);
    });
    Future.delayed(const Duration(minutes: 1), () {
      if (mounted) _updateBattery();
    });
  }

  void _updateTime() {
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) {
        final now = DateTime.now();
        setState(() {
          _currentTime = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
        });
        _updateTime();
      }
    });
  }

  Future<void> _startMonitoringService() async {
    await FlutterForegroundTask.startService(
      notificationTitle: '📍 Monitoraggio attivo',
      notificationText: 'GPS e anello connessi',
      callback: startCallback,
    );
  }

  // Sblocco admin: tap 5 volte sull'orologio
  void _handleAdminTap() {
    final now = DateTime.now();
    
    if (_lastAdminTap == null || now.difference(_lastAdminTap!) > const Duration(seconds: 3)) {
      _adminTapCount = 1;
    } else {
      _adminTapCount++;
    }
    _lastAdminTap = now;
    
    if (_adminTapCount >= 5) {
      _showAdminDialog();
      _adminTapCount = 0;
    }
  }

  void _showAdminDialog() {
    showDialog(
      context: context,
      builder: (context) => AdminPinDialog(
        onSuccess: () {
          // Sblocca temporaneamente il kiosk mode
          Navigator.of(context).pop();
          _showAdminMenu();
        },
      ),
    );
  }

  void _showAdminMenu() {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Menu Amministratore', 
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            ListTile(
              leading: const Icon(Icons.settings, size: 32),
              title: const Text('Impostazioni Sistema', style: TextStyle(fontSize: 20)),
              onTap: () {
                // Apri impostazioni Android
                const platform = MethodChannel('app.channel.shared.data');
                platform.invokeMethod('openSettings');
              },
            ),
            ListTile(
              leading: const Icon(Icons.bluetooth, size: 32),
              title: const Text('Riconnetti Anello', style: TextStyle(fontSize: 20)),
              onTap: () {
                Navigator.pop(context);
                // Riconnetti ring
              },
            ),
            ListTile(
              leading: const Icon(Icons.exit_to_app, size: 32),
              title: const Text('Esci da Kiosk Mode', style: TextStyle(fontSize: 20)),
              onTap: () {
                // Ripristina barre di sistema
                SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
    return PopScope(
      // Blocca tasto back
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        // Non fare nulla quando premi back
      },
      child: Scaffold(
        backgroundColor: Colors.grey[100],
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: isLandscape ? _buildLandscapeLayout() : _buildPortraitLayout(),
          ),
        ),
      ),
    );
  }

  Widget _buildPortraitLayout() {
    return Column(
      children: [
                // ═══════════════════════════════════════════════════
                // HEADER CON OROLOGIO
                // ═══════════════════════════════════════════════════
                GestureDetector(
                  onTap: _handleAdminTap,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Text(
                      _currentTime,
                      style: const TextStyle(
                        fontSize: 72,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // ═══════════════════════════════════════════════════
                // GRIGLIA BOTTONI PRINCIPALI
                // ═══════════════════════════════════════════════════
                Expanded(
                  child: GridView.count(
                    crossAxisCount: 2,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 16,
                    childAspectRatio: 1.0,
                    children: [
                      // TELEFONO
                      _buildMainButton(
                        icon: Icons.phone,
                        label: 'CHIAMA',
                        color: Colors.green,
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PhoneScreen()),
                        ),
                      ),
                      
                      // CONTATTI FAMIGLIA
                      _buildMainButton(
                        icon: Icons.people,
                        label: 'FAMIGLIA',
                        color: Colors.blue,
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const ContactsScreen()),
                        ),
                      ),
                      
                      // SALUTE (LINKTOP)
                      _buildMainButton(
                        icon: Icons.favorite,
                        label: 'SALUTE',
                        color: Colors.red,
                        badge: _linktopConnected ? '✓' : null,
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const HealthScreen()),
                        ),
                      ),
                      
                      // ANELLO (COLMI)
                      _buildMainButton(
                        icon: Icons.watch,
                        label: 'ANELLO',
                        color: Colors.purple,
                        badge: _ringConnected ? '✓' : null,
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const RingScreen()),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // ═══════════════════════════════════════════════════
                // BOTTONE SOS GRANDE
                // ═══════════════════════════════════════════════════
                SizedBox(
                  width: double.infinity,
                  height: 120,
                  child: ElevatedButton(
                    onPressed: _handleSOS,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red[700],
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(25),
                      ),
                    ),
                    child: const FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.emergency, size: 48),
                          SizedBox(width: 12),
                          Text(
                            'EMERGENZA SOS',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // ═══════════════════════════════════════════════════
                // BARRA DI STATO
                // ═══════════════════════════════════════════════════
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(15),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 5,
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildStatusIcon(
                        icon: Icons.watch,
                        label: 'Anello',
                        isConnected: _ringConnected,
                      ),
                      _buildStatusIcon(
                        icon: Icons.bluetooth,
                        label: 'Linktop',
                        isConnected: _linktopConnected,
                      ),
                      _buildStatusIcon(
                        icon: Icons.gps_fixed,
                        label: 'GPS',
                        isConnected: true,
                      ),
                      Row(
                        children: [
                          Icon(
                            _batteryLevel > 20 ? Icons.battery_full : Icons.battery_alert,
                            color: _batteryLevel > 20 ? Colors.green : Colors.red,
                            size: 28,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$_batteryLevel%',
                            style: const TextStyle(fontSize: 18),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
    );
  }

  Widget _buildLandscapeLayout() {
    return Row(
      children: [
        // Colonna sinistra: orologio + SOS + status
        Expanded(
          flex: 2,
          child: Column(
            children: [
              GestureDetector(
                onTap: _handleAdminTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text(
                    _currentTime,
                    style: const TextStyle(
                      fontSize: 84,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: 100,
                child: ElevatedButton(
                  onPressed: _handleSOS,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red[700],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: const FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.emergency, size: 40),
                        SizedBox(width: 10),
                        Text('EMERGENZA SOS',
                            style: TextStyle(
                                fontSize: 26, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(15),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 5,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatusIcon(
                      icon: Icons.watch,
                      label: 'Anello',
                      isConnected: _ringConnected,
                    ),
                    _buildStatusIcon(
                      icon: Icons.bluetooth,
                      label: 'Linktop',
                      isConnected: _linktopConnected,
                    ),
                    _buildStatusIcon(
                      icon: Icons.gps_fixed,
                      label: 'GPS',
                      isConnected: true,
                    ),
                    Row(
                      children: [
                        Icon(
                          _batteryLevel > 20
                              ? Icons.battery_full
                              : Icons.battery_alert,
                          color: _batteryLevel > 20
                              ? Colors.green
                              : Colors.red,
                          size: 24,
                        ),
                        const SizedBox(width: 4),
                        Text('$_batteryLevel%',
                            style: const TextStyle(fontSize: 16)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        // Colonna destra: griglia 2x2 bottoni
        Expanded(
          flex: 3,
          child: GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 1.2,
            children: [
              _buildMainButton(
                icon: Icons.phone,
                label: 'CHIAMA',
                color: Colors.green,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PhoneScreen()),
                ),
              ),
              _buildMainButton(
                icon: Icons.people,
                label: 'FAMIGLIA',
                color: Colors.blue,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ContactsScreen()),
                ),
              ),
              _buildMainButton(
                icon: Icons.favorite,
                label: 'SALUTE',
                color: Colors.red,
                badge: _linktopConnected ? '✓' : null,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const HealthScreen()),
                ),
              ),
              _buildMainButton(
                icon: Icons.watch,
                label: 'ANELLO',
                color: Colors.purple,
                badge: _ringConnected ? '✓' : null,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const RingScreen()),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMainButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
    String? badge,
  }) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(25),
      elevation: 4,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(25),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 64, color: Colors.white),
                  const SizedBox(height: 12),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            if (badge != null)
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    badge,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusIcon({
    required IconData icon,
    required String label,
    required bool isConnected,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          color: isConnected ? Colors.green : Colors.grey,
          size: 24,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: isConnected ? Colors.green : Colors.grey,
          ),
        ),
      ],
    );
  }

  void _handleSOS() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.emergency, color: Colors.red, size: 40),
            SizedBox(width: 10),
            Text('EMERGENZA', style: TextStyle(fontSize: 28)),
          ],
        ),
        content: const Text(
          'Vuoi chiamare il numero di emergenza?',
          style: TextStyle(fontSize: 22),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('ANNULLA', style: TextStyle(fontSize: 20)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _callEmergencyNumber();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('CHIAMA ORA', style: TextStyle(fontSize: 20)),
          ),
        ],
      ),
    );
  }

  void _callEmergencyNumber() {
    // Chiama il numero di emergenza configurato (familiare o 118)
    const platform = MethodChannel('app.channel.shared.data');
    platform.invokeMethod('makeCall', {'number': '+393398063701'}); // Numero familiare
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIALOG PIN ADMIN
// ═══════════════════════════════════════════════════════════════════════════

class AdminPinDialog extends StatefulWidget {
  final VoidCallback onSuccess;
  
  const AdminPinDialog({super.key, required this.onSuccess});

  @override
  State<AdminPinDialog> createState() => _AdminPinDialogState();
}

class _AdminPinDialogState extends State<AdminPinDialog> {
  String _pin = '';
  static const String _correctPin = '1234'; // PIN admin (configurabile)

  void _addDigit(String digit) {
    if (_pin.length < 4) {
      setState(() {
        _pin += digit;
      });
      
      if (_pin.length == 4) {
        if (_pin == _correctPin) {
          widget.onSuccess();
        } else {
          setState(() {
            _pin = '';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('PIN errato')),
          );
        }
      }
    }
  }

  void _removeDigit() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('PIN Amministratore'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Indicatori PIN
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (index) {
              return Container(
                margin: const EdgeInsets.all(8),
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: index < _pin.length ? Colors.blue : Colors.grey[300],
                ),
              );
            }),
          ),
          const SizedBox(height: 20),
          // Tastierino numerico
          ...List.generate(3, (row) {
            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (col) {
                final digit = '${row * 3 + col + 1}';
                return Padding(
                  padding: const EdgeInsets.all(4),
                  child: ElevatedButton(
                    onPressed: () => _addDigit(digit),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(60, 60),
                    ),
                    child: Text(digit, style: const TextStyle(fontSize: 24)),
                  ),
                );
              }),
            );
          }),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(width: 68),
              Padding(
                padding: const EdgeInsets.all(4),
                child: ElevatedButton(
                  onPressed: () => _addDigit('0'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(60, 60),
                  ),
                  child: const Text('0', style: TextStyle(fontSize: 24)),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(4),
                child: ElevatedButton(
                  onPressed: _removeDigit,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(60, 60),
                  ),
                  child: const Icon(Icons.backspace),
                ),
              ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Annulla'),
        ),
      ],
    );
  }
}
