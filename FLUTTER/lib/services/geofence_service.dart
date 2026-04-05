// lib/services/geofence_service.dart
// Servizio per il monitoraggio delle zone geografiche (geofencing)

import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/geofence.dart';

class GeofenceService {
  final SupabaseClient _supabase;
  final String _patientId;
  
  List<Geofence> _geofences = [];
  Geofence? _homeGeofence;  // Cache della zona "Casa"
  
  // Stream per notificare eventi geofence
  final _eventController = StreamController<GeofenceCheckResult>.broadcast();
  Stream<GeofenceCheckResult> get events => _eventController.stream;
  
  // Callback per eventi (alternativa allo stream)
  Function(GeofenceCheckResult)? onGeofenceEvent;

  GeofenceService({
    required SupabaseClient supabase,
    required String patientId,
  })  : _supabase = supabase,
        _patientId = patientId;

  // ═══════════════════════════════════════════════════════════════
  // INIZIALIZZAZIONE
  // ═══════════════════════════════════════════════════════════════

  /// Carica i geofence dal database
  Future<void> loadGeofences() async {
    try {
      final response = await _supabase
          .from('geofences')
          .select()
          .eq('patient_id', _patientId)
          .eq('is_active', true);

      _geofences = (response as List)
          .map((json) => Geofence.fromJson(json))
          .toList();

      // Trova e salva la zona Casa per accesso rapido
      _homeGeofence = _geofences.firstWhere(
        (g) => g.type == GeofenceType.home,
        orElse: () => _geofences.isNotEmpty ? _geofences.first : throw Exception('Nessun geofence configurato'),
      );

      print('📍 Caricati ${_geofences.length} geofence');
    } catch (e) {
      print('Errore caricamento geofences: $e');
      rethrow;
    }
  }

  /// Ricarica i geofence (utile quando vengono modificati da dashboard)
  Future<void> refreshGeofences() async {
    await loadGeofences();
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK POSIZIONE
  // ═══════════════════════════════════════════════════════════════

  /// Controlla la posizione contro tutti i geofence attivi
  /// Ritorna la lista di eventi generati (entrate/uscite)
  List<GeofenceCheckResult> checkPosition(Position position) {
    List<GeofenceCheckResult> results = [];

    for (var geofence in _geofences) {
      if (!geofence.isActive) continue;

      GeofenceEvent? event = geofence.updateState(position);
      
      if (event != null) {
        // C'è stato un cambio di stato
        bool shouldNotify = false;
        
        if (event == GeofenceEvent.enter && geofence.notifyOnEnter) {
          shouldNotify = true;
        } else if (event == GeofenceEvent.exit && geofence.notifyOnExit) {
          shouldNotify = true;
        }

        if (shouldNotify) {
          final result = GeofenceCheckResult(
            geofence: geofence,
            event: event,
            position: position,
            distanceFromCenter: geofence.distanceFrom(position),
          );
          
          results.add(result);
          
          // Notifica via stream
          _eventController.add(result);
          
          // Notifica via callback
          onGeofenceEvent?.call(result);
        }
      }
    }

    return results;
  }

  /// Controlla la posizione e salva gli eventi nel database
  Future<List<GeofenceCheckResult>> checkAndLogPosition(Position position) async {
    final events = checkPosition(position);
    
    // Salva ogni evento nel database
    for (var event in events) {
      await _logGeofenceEvent(event);
    }
    
    return events;
  }

  /// Salva un evento geofence nel database
  Future<void> _logGeofenceEvent(GeofenceCheckResult result) async {
    try {
      // 1. Inserisci nella tabella geofence_events
      await _supabase.from('geofence_events').insert({
        'patient_id': _patientId,
        'geofence_id': result.geofence.id,
        'event_type': result.event.name,
        'lat': result.position.latitude,
        'lng': result.position.longitude,
        'accuracy': result.position.accuracy,
        'distance_from_center': result.distanceFromCenter,
      });

      // 2. Se è un evento significativo, crea un alert
      if (_shouldCreateAlert(result)) {
        await _createAlert(result);
      }

      print('📍 Evento geofence salvato: ${result.event.name} - ${result.geofence.name}');
    } catch (e) {
      print('Errore salvataggio evento geofence: $e');
    }
  }

  /// Determina se creare un alert per l'evento
  bool _shouldCreateAlert(GeofenceCheckResult result) {
    // Alert sempre per uscita da casa
    if (result.geofence.type == GeofenceType.home && 
        result.event == GeofenceEvent.exit) {
      return true;
    }
    
    // Alert per entrata in zona medica (potrebbe indicare problema)
    if (result.geofence.type == GeofenceType.medical && 
        result.event == GeofenceEvent.enter) {
      return true;
    }
    
    return false;
  }

  /// Crea un alert nel database
  Future<void> _createAlert(GeofenceCheckResult result) async {
    String alertType;
    String message;
    String severity;

    if (result.geofence.type == GeofenceType.home && 
        result.event == GeofenceEvent.exit) {
      alertType = 'left_home';
      message = '${result.geofence.icon} Ha lasciato casa';
      severity = 'info';
    } else if (result.geofence.type == GeofenceType.medical) {
      alertType = 'entered_medical';
      message = '🏥 È entrato in una struttura medica';
      severity = 'warning';
    } else {
      alertType = 'geofence_${result.event.name}';
      message = '${result.geofence.icon} ${result.event == GeofenceEvent.enter ? "Entrato in" : "Uscito da"} ${result.geofence.name}';
      severity = 'info';
    }

    await _supabase.from('alerts').insert({
      'patient_id': _patientId,
      'type': alertType,
      'message': message,
      'severity': severity,
      'data': result.toJson(),
      'is_read': false,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // QUERY E STATO
  // ═══════════════════════════════════════════════════════════════

  /// Ritorna la zona in cui si trova attualmente l'anziano
  Geofence? getCurrentZone(Position position) {
    for (var geofence in _geofences) {
      if (geofence.containsPosition(position)) {
        return geofence;
      }
    }
    return null;  // Non in nessuna zona nota
  }

  /// Ritorna tutte le zone in cui si trova (potrebbero sovrapporsi)
  List<Geofence> getAllCurrentZones(Position position) {
    return _geofences
        .where((g) => g.containsPosition(position))
        .toList();
  }

  /// Controlla se l'anziano è a casa
  bool isAtHome(Position position) {
    return _homeGeofence?.containsPosition(position) ?? false;
  }

  /// Ritorna il tempo trascorso fuori casa
  Duration? getTimeOutsideHome() {
    return _homeGeofence?.timeOutside;
  }

  /// Controlla se l'anziano è fuori casa da troppo tempo
  bool isOutsideHomeTooLong({Duration threshold = const Duration(hours: 2)}) {
    final timeOutside = getTimeOutsideHome();
    if (timeOutside == null) return false;
    return timeOutside > threshold;
  }

  /// Ritorna lo stato corrente di tutti i geofence
  Map<String, bool> getGeofenceStates() {
    return {
      for (var g in _geofences) g.name: g.isCurrentlyInside,
    };
  }

  /// Ritorna la distanza dalla casa
  double? getDistanceFromHome(Position position) {
    return _homeGeofence?.distanceFrom(position);
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTIONE GEOFENCE (CRUD)
  // ═══════════════════════════════════════════════════════════════

  /// Aggiunge un nuovo geofence
  Future<Geofence> addGeofence({
    required String name,
    required double latitude,
    required double longitude,
    double radiusMeters = 50.0,
    GeofenceType type = GeofenceType.custom,
    bool notifyOnEnter = true,
    bool notifyOnExit = true,
  }) async {
    final geofence = Geofence(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      patientId: _patientId,
      name: name,
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
      type: type,
      notifyOnEnter: notifyOnEnter,
      notifyOnExit: notifyOnExit,
    );

    await _supabase.from('geofences').insert(geofence.toJson());
    
    _geofences.add(geofence);
    
    if (type == GeofenceType.home) {
      _homeGeofence = geofence;
    }

    return geofence;
  }

  /// Rimuove un geofence
  Future<void> removeGeofence(String geofenceId) async {
    await _supabase
        .from('geofences')
        .delete()
        .eq('id', geofenceId);

    _geofences.removeWhere((g) => g.id == geofenceId);
    
    if (_homeGeofence?.id == geofenceId) {
      _homeGeofence = null;
    }
  }

  /// Disattiva temporaneamente un geofence
  Future<void> toggleGeofence(String geofenceId, bool isActive) async {
    await _supabase
        .from('geofences')
        .update({'is_active': isActive})
        .eq('id', geofenceId);

    await refreshGeofences();
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITÀ
  // ═══════════════════════════════════════════════════════════════

  /// Crea i geofence di default per un nuovo paziente
  Future<void> createDefaultGeofences(Position homePosition) async {
    // Zona Casa (la più importante)
    await addGeofence(
      name: 'Casa',
      latitude: homePosition.latitude,
      longitude: homePosition.longitude,
      radiusMeters: 50,
      type: GeofenceType.home,
      notifyOnEnter: true,
      notifyOnExit: true,
    );

    print('✅ Geofence Casa creato');
  }

  /// Genera un report della cronologia movimenti
  Future<List<Map<String, dynamic>>> getMovementHistory({
    DateTime? from,
    DateTime? to,
  }) async {
    var query = _supabase
        .from('geofence_events')
        .select('*, geofences(name, type)')
        .eq('patient_id', _patientId);

    if (from != null) {
      query = query.gte('created_at', from.toIso8601String());
    }
    if (to != null) {
      query = query.lte('created_at', to.toIso8601String());
    }

    final response = await query
        .order('created_at', ascending: false)
        .limit(100);
    return List<Map<String, dynamic>>.from(response);
  }

  // Getters
  List<Geofence> get geofences => List.unmodifiable(_geofences);
  Geofence? get homeGeofence => _homeGeofence;
  int get geofenceCount => _geofences.length;

  /// Pulizia risorse
  void dispose() {
    _eventController.close();
  }
}
