// lib/models/geofence.dart
// Modello per le zone geografiche (geofence)

import 'package:geolocator/geolocator.dart';

enum GeofenceType {
  home,       // Casa dell'anziano
  safe,       // Zona sicura (bar, farmacia, chiesa...)
  medical,    // Struttura medica
  family,     // Casa di un familiare
  custom,     // Zona personalizzata
}

enum GeofenceEvent {
  enter,      // Entrato nella zona
  exit,       // Uscito dalla zona
  dwell,      // Rimasto nella zona per X minuti
}

class Geofence {
  final String id;
  final String patientId;
  final String name;
  final double latitude;
  final double longitude;
  final double radiusMeters;
  final GeofenceType type;
  final bool isActive;
  final bool notifyOnEnter;
  final bool notifyOnExit;
  final int? dwellTimeMinutes;  // Notifica se rimane fuori casa per X minuti
  final DateTime createdAt;
  
  // Stato runtime (non salvato in DB)
  bool _isInside = false;
  DateTime? _lastEnterTime;
  DateTime? _lastExitTime;

  Geofence({
    required this.id,
    required this.patientId,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.radiusMeters = 50.0,
    this.type = GeofenceType.custom,
    this.isActive = true,
    this.notifyOnEnter = true,
    this.notifyOnExit = true,
    this.dwellTimeMinutes,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  // Costruttore da JSON (Supabase)
  factory Geofence.fromJson(Map<String, dynamic> json) {
    return Geofence(
      id: json['id'],
      patientId: json['patient_id'],
      name: json['name'],
      latitude: (json['lat'] as num).toDouble(),
      longitude: (json['lng'] as num).toDouble(),
      radiusMeters: (json['radius_meters'] as num?)?.toDouble() ?? 50.0,
      type: GeofenceType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => GeofenceType.custom,
      ),
      isActive: json['is_active'] ?? true,
      notifyOnEnter: json['notify_on_enter'] ?? true,
      notifyOnExit: json['notify_on_exit'] ?? true,
      dwellTimeMinutes: json['dwell_time_minutes'],
      createdAt: DateTime.parse(json['created_at']),
    );
  }

  // Conversione a JSON per Supabase
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patient_id': patientId,
      'name': name,
      'lat': latitude,
      'lng': longitude,
      'radius_meters': radiusMeters,
      'type': type.name,
      'is_active': isActive,
      'notify_on_enter': notifyOnEnter,
      'notify_on_exit': notifyOnExit,
      'dwell_time_minutes': dwellTimeMinutes,
      'created_at': createdAt.toIso8601String(),
    };
  }

  // Calcola distanza dalla posizione corrente
  double distanceFrom(Position position) {
    return Geolocator.distanceBetween(
      latitude,
      longitude,
      position.latitude,
      position.longitude,
    );
  }

  // Controlla se la posizione è dentro il geofence
  // Considera anche l'accuratezza GPS per evitare falsi positivi
  bool containsPosition(Position position) {
    double distance = distanceFrom(position);
    // Se l'accuratezza è scarsa, usa un margine più ampio
    double effectiveRadius = radiusMeters + (position.accuracy / 2);
    return distance <= effectiveRadius;
  }

  // Aggiorna lo stato e ritorna l'evento se c'è stato un cambio
  GeofenceEvent? updateState(Position position) {
    bool wasInside = _isInside;
    _isInside = containsPosition(position);

    if (!wasInside && _isInside) {
      // ENTRATA
      _lastEnterTime = DateTime.now();
      return GeofenceEvent.enter;
    } else if (wasInside && !_isInside) {
      // USCITA
      _lastExitTime = DateTime.now();
      return GeofenceEvent.exit;
    }
    
    return null; // Nessun cambio
  }

  // Getters per lo stato
  bool get isCurrentlyInside => _isInside;
  DateTime? get lastEnterTime => _lastEnterTime;
  DateTime? get lastExitTime => _lastExitTime;
  
  // Tempo trascorso fuori casa (per alert "anziano fuori da troppo tempo")
  Duration? get timeOutside {
    if (_isInside || _lastExitTime == null) return null;
    return DateTime.now().difference(_lastExitTime!);
  }

  // Icona per UI
  String get icon {
    switch (type) {
      case GeofenceType.home:
        return '🏠';
      case GeofenceType.safe:
        return '✅';
      case GeofenceType.medical:
        return '🏥';
      case GeofenceType.family:
        return '👨‍👩‍👧';
      case GeofenceType.custom:
        return '📍';
    }
  }

  @override
  String toString() {
    return 'Geofence($name, ${radiusMeters}m, inside: $_isInside)';
  }
}

// Risultato del check geofence
class GeofenceCheckResult {
  final Geofence geofence;
  final GeofenceEvent event;
  final Position position;
  final DateTime timestamp;
  final double distanceFromCenter;

  GeofenceCheckResult({
    required this.geofence,
    required this.event,
    required this.position,
    required this.distanceFromCenter,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() {
    return {
      'geofence_id': geofence.id,
      'geofence_name': geofence.name,
      'event': event.name,
      'lat': position.latitude,
      'lng': position.longitude,
      'accuracy': position.accuracy,
      'distance_from_center': distanceFromCenter,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}
