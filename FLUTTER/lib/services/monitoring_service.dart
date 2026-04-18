// lib/services/monitoring_service.dart
// Servizio di monitoraggio completo: GPS, Geofencing, BLE Ring, Comandi Remoti

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'colmi_ring_service.dart';
import 'geofence_service.dart';
import '../models/geofence.dart';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURAZIONE FOREGROUND TASK
// ═══════════════════════════════════════════════════════════════════════════

void initForegroundTask() {
  FlutterForegroundTask.init(
    androidNotificationOptions: AndroidNotificationOptions(
      channelId: 'elderly_monitoring',
      channelName: 'Monitoraggio Anziano',
      channelDescription: 'Monitoraggio posizione e salute attivo',
      channelImportance: NotificationChannelImportance.LOW,
      priority: NotificationPriority.LOW,
    ),
    iosNotificationOptions: const IOSNotificationOptions(
      showNotification: true,
      playSound: false,
    ),
    foregroundTaskOptions: ForegroundTaskOptions(
      eventAction: ForegroundTaskEventAction.repeat(60000),
      autoRunOnBoot: true,
      allowWakeLock: true,
      allowWifiLock: true,
    ),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK HANDLER PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

class MonitoringTaskHandler extends TaskHandler {
  // Servizi
  final ColmiRingService _ringService = ColmiRingService();
  late final GeofenceService _geofenceService;
  late final SupabaseClient _supabase;
  final Battery _battery = Battery();
  
  // Configurazione
  String? _patientId;
  
  // Timers
  Timer? _gpsTimer;
  Timer? _syncTimer;
  Timer? _outsideHomeCheckTimer;
  StreamSubscription<Position>? _positionStream;
  
  // Channels Supabase
  RealtimeChannel? _commandsChannel;
  RealtimeChannel? _gpsCommandsChannel;
  
  // Stato
  Position? _lastPosition;
  bool _isRingConnected = false;
  
  // Configurazione intervalli (modificabili da remoto)
  Duration _gpsInterval = const Duration(minutes: 5);
  Duration _syncInterval = const Duration(minutes: 30);
  Duration _maxTimeOutsideHome = const Duration(hours: 3);

  // Polling comandi GPS (background affidabile)
  static const String _apiBase = 'https://www.monitoraggiosalute.com/api';
  final Set<int> _handledCommandIds = {};
  int _repeatCount = 0;

  // Callback per videochiamata in arrivo (gestito dall'isolate principale)
  static void Function(String roomName, String jwt)? onVideoCallCommand;

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    print('🚀 MonitoringService avviato');
    
    // Inizializza Supabase
    _supabase = Supabase.instance.client;
    
    // Carica ID paziente
    _patientId = await _getPatientId();
    if (_patientId == null) {
      print('❌ Errore: Patient ID non trovato');
      return;
    }
    
    // Inizializza GeofenceService
    _geofenceService = GeofenceService(
      supabase: _supabase,
      patientId: _patientId!,
    );
    
    // Carica configurazione e geofence
    await _loadConfiguration();
    await _geofenceService.loadGeofences();
    
    // Configura callback eventi geofence
    _geofenceService.onGeofenceEvent = _onGeofenceEvent;
    
    // 1. Connetti all'anello Colmi
    await _connectToRing();
    
    // 2. Avvia GPS tracking con geofencing
    _startGpsTracking();
    
    // 3. Avvia sync periodico dati ring
    _startPeriodicSync();
    
    // 4. Ascolta comandi remoti da Supabase (remote_commands)
    _listenForRemoteCommands();

    // 4b. Ascolta comandi GPS da linktop_app_commands (realtime — istantaneo)
    _listenForGpsCommands();

    // 5. Avvia controllo "fuori casa troppo tempo"
    _startOutsideHomeCheck();
    
    // 6. Esegui prima lettura GPS immediata
    await _performGpsCheck();
    
    print('✅ MonitoringService configurato completamente');
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    // Chiamato ogni 60s dal foreground task — affidabile anche a schermo spento
    _repeatCount++;

    // Polling comandi GPS ad ogni ciclo (ogni 60s)
    _pollGpsCommands();

    // Invio posizione GPS ogni 5 minuti
    if (_repeatCount % 5 == 0) {
      _performGpsCheck();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMANDI GPS (realtime + polling backup)
  // ═══════════════════════════════════════════════════════════════

  /// Listener realtime Supabase per linktop_app_commands — risposta istantanea
  void _listenForGpsCommands() {
    if (_patientId == null) return;
    try {
      final patientIdInt = int.tryParse(_patientId!);
      if (patientIdInt == null) return;
      _gpsCommandsChannel = _supabase
          .channel('monitoring_gps_commands_$_patientId')
          .onPostgresChanges(
            event: PostgresChangeEvent.insert,
            schema: 'public',
            table: 'linktop_app_commands',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'paziente_id',
              value: patientIdInt,
            ),
            callback: (payload) async {
              final row = payload.newRecord;
              final id = row['id'] as int?;
              final cmd = row['command'] as String?;
              final status = row['status'] as String?;
              if (id == null || cmd == null || status != 'pending') return;
              if (_handledCommandIds.contains(id)) return;
              _handledCommandIds.add(id);
              print('[MonitoringService] Comando realtime: $cmd (id=$id)');
              if (cmd == 'get_position') {
                await _sendGpsPosition(commandId: id);
              } else if (cmd == 'video_call') {
                final payload = row['payload'] as Map<String, dynamic>?;
                if (payload != null && onVideoCallCommand != null) {
                  onVideoCallCommand!(
                    payload['room_name'] as String? ?? '',
                    payload['jwt_guest'] as String? ?? '',
                  );
                }
              }
            },
          )
          .subscribe();
      print('[MonitoringService] Listener GPS commands attivo');
    } catch (e) {
      print('[MonitoringService] Errore listener GPS commands: $e');
    }
  }

  Future<void> _pollGpsCommands() async {
    if (_patientId == null) return;
    try {
      final response = await http.get(
        Uri.parse('$_apiBase/gps/pending-commands/$_patientId'),
      );
      if (response.statusCode != 200) return;
      final data = jsonDecode(response.body);
      if (data['success'] != true) return;
      final List commands = data['data'] ?? [];
      for (final row in commands) {
        final id = row['id'] as int;
        if (_handledCommandIds.contains(id)) continue;
        _handledCommandIds.add(id);
        final cmd = row['command'] as String?;
        print('[MonitoringService] Comando ricevuto: $cmd (id=$id)');
        if (cmd == 'get_position') {
          await _sendGpsPosition(commandId: id);
        } else if (cmd == 'video_call') {
          final payload = row['payload'] as Map<String, dynamic>?;
          if (payload != null && MonitoringTaskHandler.onVideoCallCommand != null) {
            MonitoringTaskHandler.onVideoCallCommand!(
              payload['room_name'] as String? ?? '',
              payload['jwt_guest'] as String? ?? '',
            );
          }
        }
        // misura_anello gestito dall'isolate principale via GpsService
      }
    } catch (e) {
      print('[MonitoringService] Errore polling comandi: $e');
    }
  }

  Future<void> _sendGpsPosition({int? commandId}) async {
    if (_patientId == null) return;
    try {
      // Usa _lastPosition dal stream se fresca (< 10 min), altrimenti richiede nuova
      Position? position = _lastPosition;
      final now = DateTime.now();
      final isFresh = position != null &&
          now.difference(position.timestamp).inMinutes < 10;
      if (!isFresh) {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 30),
          ),
        );
      }
      final batteryLevel = await _battery.batteryLevel;
      await http.post(
        Uri.parse('$_apiBase/gps/position'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'paziente_id': _patientId,
          'lat': position.latitude,
          'lng': position.longitude,
          'accuracy': position.accuracy,
          'altitude': position.altitude,
          'speed': position.speed,
          'heading': position.heading,
          'battery_level': batteryLevel,
          'source': commandId != null ? 'request' : 'auto',
        }),
      );
      if (commandId != null) {
        await http.post(
          Uri.parse('$_apiBase/gps/pending-commands/$_patientId'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'command_id': commandId,
            'result': {
              'lat': position.latitude,
              'lng': position.longitude,
              'accuracy': position.accuracy,
            },
          }),
        );
      }
      print('[MonitoringService] Posizione inviata (cmd=$commandId)');
    } catch (e) {
      print('[MonitoringService] Errore invio posizione: $e');
      if (commandId != null) {
        await http.post(
          Uri.parse('$_apiBase/gps/pending-commands/$_patientId'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'command_id': commandId, 'error': e.toString()}),
        );
      }
    }
  }

  @override
  Future<void> onDestroy(DateTime timestamp) async {
    print('🛑 MonitoringService in chiusura...');
    
    // Cancella timers e stream
    _gpsTimer?.cancel();
    _syncTimer?.cancel();
    _outsideHomeCheckTimer?.cancel();
    await _positionStream?.cancel();
    
    // Cancella subscriptions
    await _commandsChannel?.unsubscribe();
    await _gpsCommandsChannel?.unsubscribe();
    
    // Disconnetti ring
    await _ringService.disconnect();
    
    // Pulisci risorse
    _geofenceService.dispose();
    
    print('✅ MonitoringService chiuso');
  }

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURAZIONE
  // ═══════════════════════════════════════════════════════════════

  Future<String?> _getPatientId() async {
    // Recupera da storage locale o da Supabase auth
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('patient_id');
  }

  Future<void> _loadConfiguration() async {
    try {
      final config = await _supabase
          .from('patient_settings')
          .select()
          .eq('patient_id', _patientId!)
          .maybeSingle();
      
      if (config != null) {
        _gpsInterval = Duration(minutes: config['gps_interval_minutes'] ?? 5);
        _syncInterval = Duration(minutes: config['sync_interval_minutes'] ?? 30);
        _maxTimeOutsideHome = Duration(hours: config['max_hours_outside_home'] ?? 3);
      }
    } catch (e) {
      print('Usando configurazione default: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONNESSIONE RING COLMI
  // ═══════════════════════════════════════════════════════════════

  Future<void> _connectToRing() async {
    try {
      print('🔍 Cercando anello Colmi...');
      
      final rings = await _ringService.scanForRings(
        timeout: const Duration(seconds: 15),
      );
      
      if (rings.isNotEmpty) {
        _isRingConnected = await _ringService.connect(rings.first.device);
        
        if (_isRingConnected) {
          print('✅ Anello Colmi connesso: ${rings.first.device.platformName}');
          
          // Aggiorna stato nel DB
          await _updateDeviceStatus('ring_connected', true);
          
          // Leggi batteria iniziale
          final battery = await _ringService.getBatteryLevel();
          if (battery != null) {
            await _updateDeviceStatus('ring_battery', battery);
          }
        }
      } else {
        print('⚠️ Nessun anello Colmi trovato');
        _isRingConnected = false;
      }
    } catch (e) {
      print('❌ Errore connessione ring: $e');
      _isRingConnected = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GPS TRACKING CON GEOFENCING
  // ═══════════════════════════════════════════════════════════════

  void _startGpsTracking() {
    // Stream continuo: aggiornamento ogni 50 metri oppure ogni 5 minuti
    // Funziona anche a schermo spento grazie a foregroundServiceType="location"
    final locationSettings = Platform.isAndroid
        ? AndroidSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 50,
            intervalDuration: _gpsInterval,
            foregroundNotificationConfig: const ForegroundNotificationConfig(
              notificationText: 'GPS attivo in background',
              notificationTitle: 'Monitoraggio posizione',
              enableWakeLock: true,
            ),
          )
        : const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 50,
          );

    _positionStream = Geolocator.getPositionStream(locationSettings: locationSettings)
        .listen((Position position) async {
      _lastPosition = position;
      await _sendGpsPosition();
      await _geofenceService.checkAndLogPosition(position);
    }, onError: (e) {
      print('[MonitoringService] Errore stream GPS: $e');
    });

    print('📍 GPS stream avviato (ogni 50m o ${_gpsInterval.inMinutes} min)');
  }

  Future<void> _performGpsCheck() async {
    try {
      // 1. Ottieni posizione corrente
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 30),
      );
      
      _lastPosition = position;
      
      // 2. Controlla geofence (genera eventi se necessario)
      final events = await _geofenceService.checkAndLogPosition(position);
      
      // 3. Determina zona corrente
      final currentZone = _geofenceService.getCurrentZone(position);
      
      // 4. Ottieni livello batteria smartphone
      final phoneBattery = await _battery.batteryLevel;
      
      // 5. Salva posizione nel database
      await _supabase.from('gps_positions').insert({
        'patient_id': _patientId,
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'speed': position.speed,
        'heading': position.heading,
        'phone_battery': phoneBattery,
        'ring_battery': await _ringService.getBatteryLevel(),
        'current_zone': currentZone?.name,
        'is_indoor': position.accuracy > 30,
      });
      
      // 6. Log eventi geofence
      if (events.isNotEmpty) {
        print('📍 Eventi geofence: ${events.map((e) => "${e.event.name}:${e.geofence.name}").join(", ")}');
      }
      
      // 7. Aggiorna notifica foreground
      FlutterForegroundTask.updateService(
        notificationTitle: currentZone != null 
            ? '${currentZone.icon} ${currentZone.name}'
            : '📍 Posizione attiva',
        notificationText: 'Precisione: ±${position.accuracy.toStringAsFixed(0)}m',
      );
      
    } catch (e) {
      print('❌ Errore GPS check: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTIONE EVENTI GEOFENCE
  // ═══════════════════════════════════════════════════════════════

  void _onGeofenceEvent(GeofenceCheckResult result) {
    print('🔔 Evento geofence: ${result.event.name} - ${result.geofence.name}');
    
    // Aggiorna notifica in base all'evento
    String notification;
    
    switch (result.event) {
      case GeofenceEvent.exit:
        if (result.geofence.type == GeofenceType.home) {
          notification = '🚶 Uscito da casa';
        } else {
          notification = '📍 Uscito da ${result.geofence.name}';
        }
        break;
        
      case GeofenceEvent.enter:
        if (result.geofence.type == GeofenceType.home) {
          notification = '🏠 Tornato a casa';
        } else {
          notification = '📍 Arrivato a ${result.geofence.name}';
        }
        break;
        
      case GeofenceEvent.dwell:
        notification = '⏱️ In ${result.geofence.name} da molto tempo';
        break;
    }
    
    FlutterForegroundTask.updateService(
      notificationTitle: notification,
      notificationText: 'Ore ${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}',
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTROLLO "FUORI CASA TROPPO TEMPO"
  // ═══════════════════════════════════════════════════════════════

  void _startOutsideHomeCheck() {
    // Controlla ogni 15 minuti se l'anziano è fuori casa da troppo tempo
    _outsideHomeCheckTimer = Timer.periodic(
      const Duration(minutes: 15), 
      (_) => _checkOutsideHomeTime(),
    );
  }

  Future<void> _checkOutsideHomeTime() async {
    final timeOutside = _geofenceService.getTimeOutsideHome();
    
    if (timeOutside == null) return; // È a casa
    
    // Controlla soglie progressive
    if (timeOutside > _maxTimeOutsideHome) {
      // ALERT CRITICO: fuori casa da troppo tempo
      await _createAlert(
        type: 'outside_home_too_long',
        message: '⚠️ Fuori casa da ${timeOutside.inHours} ore',
        severity: 'critical',
        data: {
          'hours_outside': timeOutside.inHours,
          'minutes_outside': timeOutside.inMinutes,
          'last_position': _lastPosition != null ? {
            'lat': _lastPosition!.latitude,
            'lng': _lastPosition!.longitude,
          } : null,
        },
      );
    } else if (timeOutside > Duration(hours: _maxTimeOutsideHome.inHours ~/ 2)) {
      // WARNING: fuori casa da un po'
      await _createAlert(
        type: 'outside_home_warning',
        message: '📍 Fuori casa da ${timeOutside.inMinutes} minuti',
        severity: 'warning',
        data: {
          'minutes_outside': timeOutside.inMinutes,
        },
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SYNC PERIODICO DATI RING
  // ═══════════════════════════════════════════════════════════════

  void _startPeriodicSync() {
    _syncTimer = Timer.periodic(_syncInterval, (_) async {
      await _performFullSync();
    });
    
    print('🔄 Sync periodico avviato (ogni ${_syncInterval.inMinutes} min)');
  }

  Future<void> _performFullSync() async {
    if (!_isRingConnected) {
      // Tenta riconnessione
      await _connectToRing();
      if (!_isRingConnected) return;
    }
    
    try {
      print('🔄 Inizio sync dati ring...');
      
      // 1. Sync HR storico
      final hrLogs = await _ringService.getHeartRateLogs();
      for (var log in hrLogs) {
        await _supabase.from('health_measurements').upsert({
          'patient_id': _patientId,
          'type': 'hr',
          'value': log['value'],
          'source': 'sync',
          'measured_at': log['timestamp'],
        }, onConflict: 'patient_id,type,measured_at');
      }
      
      // 2. Sync SpO2 storico
      final spo2Logs = await _ringService.getSpO2Logs();
      for (var log in spo2Logs) {
        await _supabase.from('health_measurements').upsert({
          'patient_id': _patientId,
          'type': 'spo2',
          'value': log['value'],
          'source': 'sync',
          'measured_at': log['timestamp'],
        }, onConflict: 'patient_id,type,measured_at');
      }
      
      // 3. Sync passi
      final steps = await _ringService.getSteps();
      if (steps != null) {
        await _supabase.from('activity_data').upsert({
          'patient_id': _patientId,
          'date': DateTime.now().toIso8601String().split('T')[0],
          'steps': steps,
        }, onConflict: 'patient_id,date');
      }
      
      // 4. Sync batteria ring
      final ringBattery = await _ringService.getBatteryLevel();
      if (ringBattery != null) {
        await _updateDeviceStatus('ring_battery', ringBattery);
        
        // Alert batteria bassa
        if (ringBattery < 20) {
          await _createAlert(
            type: 'low_ring_battery',
            message: '🔋 Batteria anello bassa: $ringBattery%',
            severity: 'warning',
          );
        }
      }
      
      print('✅ Sync completato');
      
    } catch (e) {
      print('❌ Errore sync: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMANDI REMOTI
  // ═══════════════════════════════════════════════════════════════

  void _listenForRemoteCommands() {
    _commandsChannel = _supabase
        .channel('remote_commands')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'remote_commands',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'patient_id',
            value: _patientId!,
          ),
          callback: (payload) async {
            final command = payload.newRecord;
            if (command['status'] == 'pending') {
              await _executeRemoteCommand(command);
            }
          },
        )
        .subscribe();
    
    print('📡 Listener comandi remoti attivo');
  }

  Future<void> _executeRemoteCommand(Map<String, dynamic> command) async {
    final commandId = command['id'];
    final commandType = command['command'];
    
    print('📥 Comando ricevuto: $commandType');
    
    Map<String, dynamic>? result;
    
    try {
      switch (commandType) {
        case 'measure_spo2':
          final data = await _ringService.measureSpO2RealTime();
          if (data != null) {
            result = {
              'spo2': data['spo2'],
              'hr': data['hr'],
              'timestamp': DateTime.now().toIso8601String(),
            };
            
            // Salva anche in health_measurements
            await _supabase.from('health_measurements').insert({
              'patient_id': _patientId,
              'type': 'spo2',
              'value': data['spo2'],
              'hr': data['hr'],
              'source': 'realtime',
            });
          }
          break;
          
        case 'measure_hr':
          final readings = await _ringService.measureHRRealTime();
          if (readings != null && readings.isNotEmpty) {
            int avgHr = (readings.reduce((a, b) => a + b) / readings.length).round();
            result = {
              'hr': avgHr,
              'readings': readings,
              'timestamp': DateTime.now().toIso8601String(),
            };
            
            await _supabase.from('health_measurements').insert({
              'patient_id': _patientId,
              'type': 'hr',
              'value': avgHr,
              'source': 'realtime',
            });
          }
          break;
          
        case 'get_position':
          if (_lastPosition != null) {
            final zone = _geofenceService.getCurrentZone(_lastPosition!);
            result = {
              'lat': _lastPosition!.latitude,
              'lng': _lastPosition!.longitude,
              'accuracy': _lastPosition!.accuracy,
              'current_zone': zone?.name,
              'is_at_home': _geofenceService.isAtHome(_lastPosition!),
              'timestamp': DateTime.now().toIso8601String(),
            };
          } else {
            // Forza nuova lettura GPS
            await _performGpsCheck();
            if (_lastPosition != null) {
              final zone = _geofenceService.getCurrentZone(_lastPosition!);
              result = {
                'lat': _lastPosition!.latitude,
                'lng': _lastPosition!.longitude,
                'accuracy': _lastPosition!.accuracy,
                'current_zone': zone?.name,
                'timestamp': DateTime.now().toIso8601String(),
              };
            }
          }
          break;
          
        case 'get_status':
          result = {
            'ring_connected': _isRingConnected,
            'ring_battery': await _ringService.getBatteryLevel(),
            'phone_battery': await _battery.batteryLevel,
            'is_at_home': _lastPosition != null 
                ? _geofenceService.isAtHome(_lastPosition!)
                : null,
            'current_zone': _lastPosition != null
                ? _geofenceService.getCurrentZone(_lastPosition!)?.name
                : null,
            'geofence_states': _geofenceService.getGeofenceStates(),
            'timestamp': DateTime.now().toIso8601String(),
          };
          break;
          
        case 'refresh_geofences':
          await _geofenceService.refreshGeofences();
          result = {
            'geofence_count': _geofenceService.geofenceCount,
            'geofences': _geofenceService.geofences.map((g) => g.name).toList(),
          };
          break;
          
        case 'force_sync':
          await _performFullSync();
          result = {'synced': true};
          break;
      }
      
      // Aggiorna stato comando
      await _supabase.from('remote_commands').update({
        'status': result != null ? 'completed' : 'failed',
        'result': result ?? {'error': 'Nessun dato disponibile'},
        'completed_at': DateTime.now().toIso8601String(),
      }).eq('id', commandId);
      
      print('✅ Comando $commandType completato');
      
    } catch (e) {
      print('❌ Errore comando $commandType: $e');
      
      await _supabase.from('remote_commands').update({
        'status': 'failed',
        'result': {'error': e.toString()},
        'completed_at': DateTime.now().toIso8601String(),
      }).eq('id', commandId);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITÀ
  // ═══════════════════════════════════════════════════════════════

  Future<void> _updateDeviceStatus(String key, dynamic value) async {
    await _supabase.from('device_status').upsert({
      'patient_id': _patientId,
      'key': key,
      'value': value.toString(),
      'updated_at': DateTime.now().toIso8601String(),
    }, onConflict: 'patient_id,key');
  }

  Future<void> _createAlert({
    required String type,
    required String message,
    String severity = 'info',
    Map<String, dynamic>? data,
  }) async {
    // Evita alert duplicati negli ultimi 30 minuti
    final recent = await _supabase
        .from('alerts')
        .select('id')
        .eq('patient_id', _patientId!)
        .eq('type', type)
        .gte('created_at', DateTime.now().subtract(const Duration(minutes: 30)).toIso8601String())
        .limit(1);
    
    if ((recent as List).isEmpty) {
      await _supabase.from('alerts').insert({
        'patient_id': _patientId,
        'type': type,
        'message': message,
        'severity': severity,
        'data': data,
        'is_read': false,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CALLBACK PER FLUTTER_FOREGROUND_TASK
// ═══════════════════════════════════════════════════════════════════════════

@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(MonitoringTaskHandler());
}
