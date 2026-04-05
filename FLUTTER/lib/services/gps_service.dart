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

class GpsService {
  static const String API_BASE = 'https://www.monitoraggiosalute.com/api';
  static const Duration TRACKING_INTERVAL = Duration(minutes: 5);
  static const Duration COMMAND_POLL_INTERVAL = Duration(seconds: 3);

  Timer? _timer;
  Timer? _commandPollTimer;
  RealtimeChannel? _commandsChannel;
  int? _pazienteId;
  final Battery _battery = Battery();
  bool _isRunning = false;
  final Set<int> _handledCommands = {};

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
  }

  /// Ferma il tracking
  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    _commandPollTimer?.cancel();
    _commandPollTimer = null;
    await _commandsChannel?.unsubscribe();
    _commandsChannel = null;
    _isRunning = false;
    print('[GPS] Tracking fermato');
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
      default:
        print('[GPS] Comando non gestito: $commandType');
    }
  }

  /// Aggiorna lo status del comando via API portale
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
