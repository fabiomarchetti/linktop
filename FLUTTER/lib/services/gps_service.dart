// lib/services/gps_service.dart
// Servizio GPS: invia periodicamente la posizione al portale
// e risponde a richieste "Richiedi posizione ora" in realtime

import 'dart:async';
import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:battery_plus/battery_plus.dart';

class Geofence {
  final int id;
  final String name;
  final double centerLat;
  final double centerLng;
  final int radiusMeters;
  final bool notifyOnExit;
  final bool notifyOnEnter;
  bool? wasInside; // stato precedente (null = mai calcolato)

  Geofence({
    required this.id,
    required this.name,
    required this.centerLat,
    required this.centerLng,
    required this.radiusMeters,
    required this.notifyOnExit,
    required this.notifyOnEnter,
  });

  factory Geofence.fromJson(Map<String, dynamic> j) => Geofence(
        id: j['id'] as int,
        name: j['name'] as String,
        centerLat: double.parse(j['center_lat'].toString()),
        centerLng: double.parse(j['center_lng'].toString()),
        radiusMeters: j['radius_meters'] as int,
        notifyOnExit: j['notify_on_exit'] ?? true,
        notifyOnEnter: j['notify_on_enter'] ?? false,
      );
}

class GpsService {
  static const String API_BASE = 'https://www.monitoraggiosalute.com/api';
  static const Duration TRACKING_INTERVAL = Duration(minutes: 5);
  static const Duration COMMAND_POLL_INTERVAL = Duration(seconds: 3);
  static const Duration GEOFENCE_REFRESH_INTERVAL = Duration(minutes: 10);

  Timer? _timer;
  Timer? _commandPollTimer;
  Timer? _geofenceRefreshTimer;
  Timer? _autoMeasureTimer;
  Timer? _scheduleRefreshTimer;
  RealtimeChannel? _commandsChannel;
  int? _pazienteId;
  final Battery _battery = Battery();
  bool _isRunning = false;
  final Set<int> _handledCommands = {};
  List<Geofence> _geofences = [];
  int? _autoMeasureIntervalMinutes;

  Function(int commandId)? onMeasureRingCommand;
  void Function(String roomName, String jwt)? onVideoCallCommand;
  /// Callback per misurazioni automatiche (senza commandId)
  Future<void> Function()? onAutoMeasureRing;

  bool get isRunning => _isRunning;

  /// Avvia il tracking GPS periodico + listener comandi realtime
  Future<void> start() async {
    if (_isRunning) return;

    final prefs = await SharedPreferences.getInstance();
    final patientIdStr = prefs.getString('patient_id');
    if (patientIdStr == null) {
      print('[GPS] Nessun patient_id salvato, tracking non avviato');
      return;
    }
    _pazienteId = int.tryParse(patientIdStr);
    if (_pazienteId == null) {
      print('[GPS] patient_id non valido: $patientIdStr');
      return;
    }

    // Verifica permessi
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      print('[GPS] Permesso localizzazione negato');
      return;
    }

    _isRunning = true;
    print('[GPS] Tracking avviato per paziente $_pazienteId');

    // Prima lettura immediata
    _sendPosition(source: 'auto');

    // Timer periodico
    _timer = Timer.periodic(TRACKING_INTERVAL, (_) {
      _sendPosition(source: 'auto');
    });

    // Listener comandi realtime (se non funziona, fallback polling)
    _startCommandListener();

    // Polling backup (ogni 3 secondi)
    _commandPollTimer = Timer.periodic(COMMAND_POLL_INTERVAL, (_) {
      _pollPendingCommands();
    });

    // Carica geofences ora e ogni 10 minuti
    _loadGeofences();
    _geofenceRefreshTimer = Timer.periodic(GEOFENCE_REFRESH_INTERVAL, (_) {
      _loadGeofences();
    });

    // Carica schedule auto-misura e aggiorna ogni 5 minuti
    _fetchAndApplySchedule();
    _scheduleRefreshTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      _fetchAndApplySchedule();
    });
  }

  /// Carica le geofences del paziente dal portale
  Future<void> _loadGeofences() async {
    if (_pazienteId == null) return;
    try {
      final response = await http.get(
        Uri.parse('$API_BASE/geofences/$_pazienteId'),
      );
      if (response.statusCode != 200) return;
      final data = jsonDecode(response.body);
      if (data['success'] != true) return;
      final List rows = data['data'] ?? [];

      // Mantieni wasInside per geofence gia' note
      final Map<int, bool?> previousStates = {
        for (final g in _geofences) g.id: g.wasInside,
      };

      _geofences = rows.map((r) {
        final g = Geofence.fromJson(Map<String, dynamic>.from(r));
        g.wasInside = previousStates[g.id];
        return g;
      }).toList();

      print('[GPS] Geofences caricate: ${_geofences.length}');
    } catch (e) {
      print('[GPS] Errore caricamento geofences: $e');
    }
  }

  /// Ferma il tracking
  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    _commandPollTimer?.cancel();
    _commandPollTimer = null;
    _geofenceRefreshTimer?.cancel();
    _geofenceRefreshTimer = null;
    _autoMeasureTimer?.cancel();
    _autoMeasureTimer = null;
    _scheduleRefreshTimer?.cancel();
    _scheduleRefreshTimer = null;
    _autoMeasureIntervalMinutes = null; // reset per permettere riavvio timer
    await _commandsChannel?.unsubscribe();
    _commandsChannel = null;
    _isRunning = false;
    print('[GPS] Tracking fermato');
  }

  /// Recupera lo schedule dal portale e (ri)avvia il timer automatico
  Future<void> _fetchAndApplySchedule() async {
    if (_pazienteId == null) return;
    try {
      final response = await http.get(
        Uri.parse('$API_BASE/health/schedule/$_pazienteId'),
      );
      if (response.statusCode != 200) return;
      final data = jsonDecode(response.body);
      if (data['success'] != true) return;
      final int? interval = data['interval_minutes'];
      _applySchedule(interval);
    } catch (e) {
      print('[GPS] Errore fetch schedule: $e');
    }
  }

  void _applySchedule(int? intervalMinutes) {
    // Se l'intervallo non e' cambiato, non toccare il timer esistente
    if (_autoMeasureIntervalMinutes == intervalMinutes) return;

    // Intervallo cambiato (o disattivato): cancella il timer precedente
    _autoMeasureTimer?.cancel();
    _autoMeasureTimer = null;

    if (intervalMinutes == null || intervalMinutes <= 0) {
      if (_autoMeasureIntervalMinutes != null) {
        print('[GPS] Auto-misura disattivata');
      }
      _autoMeasureIntervalMinutes = null;
      return;
    }

    _autoMeasureIntervalMinutes = intervalMinutes;
    print('[GPS] Auto-misura attiva: ogni $intervalMinutes minuti');

    _autoMeasureTimer = Timer.periodic(Duration(minutes: intervalMinutes), (_) async {
      print('[GPS] Auto-misura: avvio misurazione programmata');
      if (onAutoMeasureRing != null) {
        await onAutoMeasureRing!();
      }
    });
  }

  /// Polling: controlla comandi pending via API del portale
  Future<void> _pollPendingCommands() async {
    if (_pazienteId == null) return;
    try {
      final response = await http.get(
        Uri.parse('$API_BASE/gps/pending-commands/$_pazienteId'),
      );
      if (response.statusCode != 200) return;

      final data = jsonDecode(response.body);
      if (data['success'] != true) return;
      final List commands = data['data'] ?? [];

      for (final row in commands) {
        final id = row['id'] as int;
        if (!_handledCommands.contains(id)) {
          _handledCommands.add(id);
          print('[GPS] Comando pending rilevato via polling: id=$id');
          await _handleCommand({
            'id': id,
            'command': row['command'],
            'status': 'pending',
          });
        }
      }
    } catch (e) {
      print('[GPS] Errore polling: $e');
    }
  }

  /// Forza l'invio immediato della posizione
  Future<void> sendNow({String source = 'manual'}) async {
    await _sendPosition(source: source);
  }

  /// Verifica se la posizione fa entrare/uscire da una geofence
  /// e notifica il portale in caso di transizione.
  void _checkGeofenceTransitions(Position position) {
    for (final g in _geofences) {
      final distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        g.centerLat,
        g.centerLng,
      );
      final isInside = distance <= g.radiusMeters;

      if (g.wasInside == null) {
        // Prima misurazione per questa zona: solo memorizza, niente notifica
        g.wasInside = isInside;
        continue;
      }

      if (isInside && g.wasInside == false) {
        // ENTRATO
        print('[GPS] ENTRATO in zona "${g.name}" (dist=${distance.toStringAsFixed(0)}m)');
        if (g.notifyOnEnter) {
          _notifyGeofenceEvent(g, 'enter', position);
        }
      } else if (!isInside && g.wasInside == true) {
        // USCITO
        print('[GPS] USCITO da zona "${g.name}" (dist=${distance.toStringAsFixed(0)}m)');
        if (g.notifyOnExit) {
          _notifyGeofenceEvent(g, 'exit', position);
        }
      }

      g.wasInside = isInside;
    }
  }

  /// Invia alert al portale
  Future<void> _notifyGeofenceEvent(Geofence g, String eventType, Position pos) async {
    try {
      final response = await http.post(
        Uri.parse('$API_BASE/alerts/geofence'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'paziente_id': _pazienteId,
          'geofence_id': g.id,
          'event_type': eventType,
          'lat': pos.latitude,
          'lng': pos.longitude,
        }),
      );
      print('[GPS] Alert geofence ${eventType}: ${response.statusCode} ${response.body}');
    } catch (e) {
      print('[GPS] Errore alert geofence: $e');
    }
  }

  /// Legge la posizione GPS e la invia al portale
  Future<Position?> _sendPosition({String source = 'auto', int? commandId}) async {
    if (_pazienteId == null) return null;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 30),
        ),
      );

      final batteryLevel = await _battery.batteryLevel;

      final body = {
        'paziente_id': _pazienteId,
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'speed': position.speed,
        'heading': position.heading,
        'battery_level': batteryLevel,
        'source': source,
      };

      print('[GPS] Invio posizione: $body');

      final response = await http.post(
        Uri.parse('$API_BASE/gps/position'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      print('[GPS] Response: ${response.statusCode}');

      // Verifica geofence: enter/exit
      _checkGeofenceTransitions(position);

      // Se e' una risposta a un comando, segnala completamento
      if (commandId != null) {
        await _completeCommand(commandId, {
          'lat': position.latitude,
          'lng': position.longitude,
          'accuracy': position.accuracy,
        });
      }

      return position;
    } catch (e) {
      print('[GPS] Errore: $e');
      if (commandId != null) {
        await _completeCommand(commandId, null, error: e.toString());
      }
      return null;
    }
  }

  /// Ascolta i comandi realtime da Supabase
  void _startCommandListener() {
    try {
      final supabase = Supabase.instance.client;
      _commandsChannel = supabase
          .channel('app_commands_$_pazienteId')
          .onPostgresChanges(
            event: PostgresChangeEvent.insert,
            schema: 'public',
            table: 'linktop_app_commands',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'paziente_id',
              value: _pazienteId,
            ),
            callback: (payload) {
              _handleCommand(payload.newRecord);
            },
          )
          .subscribe();
      print('[GPS] Listener comandi realtime attivo');
    } catch (e) {
      print('[GPS] Errore listener realtime: $e');
    }
  }

  Future<void> _handleCommand(Map<String, dynamic> command) async {
    final commandId = command['id'] as int?;
    final commandType = command['command'] as String?;
    final status = command['status'] as String?;

    if (status != 'pending' || commandType == null || commandId == null) return;

    print('[GPS] Comando ricevuto: $commandType (id=$commandId)');

    switch (commandType) {
      case 'get_position':
        await _sendPosition(source: 'request', commandId: commandId);
        break;
      case 'misura_anello':
        if (onMeasureRingCommand != null) {
          onMeasureRingCommand!(commandId!);
        } else {
          print('[GPS] onMeasureRingCommand non configurato');
          await _completeCommand(commandId!, null, error: 'handler non configurato');
        }
        break;
      case 'video_call':
        final payload = command['payload'] as Map<String, dynamic>?;
        if (payload != null && onVideoCallCommand != null) {
          onVideoCallCommand!(
            payload['room_name'] as String? ?? '',
            payload['jwt_guest'] as String? ?? '',
          );
        }
        break;
      default:
        print('[GPS] Comando non gestito: $commandType');
    }
  }

  /// Aggiorna lo status del comando via API portale
  /// Metodo pubblico per completare un comando (usato da servizi esterni come ColmiService)
  Future<void> completeCommandPublic(int commandId, Map<String, dynamic>? result, {String? error}) =>
      _completeCommand(commandId, result, error: error);

  Future<void> _completeCommand(int commandId, Map<String, dynamic>? result, {String? error}) async {
    try {
      await http.post(
        Uri.parse('$API_BASE/gps/pending-commands/$_pazienteId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'command_id': commandId,
          'result': result,
          'error': error,
        }),
      );
      print('[GPS] Comando $commandId completato');
    } catch (e) {
      print('[GPS] Errore update comando: $e');
    }
  }

  void dispose() {
    stop();
  }
}
