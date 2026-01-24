/**
 * Types per il sistema Alert AI Control Room
 */

// Severità degli alert
export type AlertSeverity = 'info' | 'warning' | 'alarm' | 'emergency'

// Stato dell'alert
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'false_positive' | 'escalated'

// Tipi di parametri monitorati
export type ParameterType = 'heart_rate' | 'spo2' | 'systolic_bp' | 'diastolic_bp' | 'temperature'

// Canali di notifica
export type NotificationChannel = 'email' | 'sms' | 'call' | 'push' | 'whatsapp' | 'dashboard'

// Tipo destinatario
export type RecipientType = 'staff' | 'caregiver' | 'patient' | 'emergency_contact_1' | 'emergency_contact_2'

// Stato notifica
export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'acknowledged'

/**
 * Regola di alert (da linktop_alert_rules)
 */
export interface AlertRule {
  id: number
  paziente_id: number | null  // null = regola globale
  parameter_type: ParameterType
  min_warning: number | null
  max_warning: number | null
  min_critical: number | null
  max_critical: number | null
  enabled: boolean
  priority: number
}

/**
 * Alert generato (da linktop_alerts)
 */
export interface Alert {
  id?: number
  paziente_id: number
  alert_type: string
  severity: AlertSeverity
  parameter_type: ParameterType
  measured_value: number
  threshold_exceeded: number | null
  health_data_id: number | null
  message: string
  status: AlertStatus
  escalation_level: number
  created_at?: Date
}

/**
 * Notifica (da linktop_notifications)
 */
export interface Notification {
  id?: number
  alert_id: number
  recipient_type: RecipientType
  recipient_id: number | null
  recipient_name: string | null
  recipient_contact: string
  channel: NotificationChannel
  message_subject: string | null
  message_content: string
  status: NotificationStatus
  provider: string | null
  provider_message_id: string | null
}

/**
 * Dati misurazione in input all'engine
 */
export interface HealthMeasurement {
  paziente_id: number
  heart_rate?: number | null
  spo2?: number | null
  systolic_bp?: number | null
  diastolic_bp?: number | null
  temperature?: number | null
  health_data_id?: number
}

/**
 * Risultato valutazione engine
 */
export interface EvaluationResult {
  has_alerts: boolean
  alerts: Alert[]
  measurements_evaluated: number
}

/**
 * Configurazione soglie per un parametro
 */
export interface ThresholdConfig {
  parameter_type: ParameterType
  min_warning: number | null
  max_warning: number | null
  min_critical: number | null
  max_critical: number | null
  priority: number
}

/**
 * Dati paziente per le notifiche
 */
export interface PatientNotificationData {
  id: number
  nome: string
  cognome: string
  email: string | null
  telefono: string | null
  emergenza_nome: string | null
  emergenza_telefono: string | null
  emergenza_relazione: string | null
  emergenza2_nome: string | null
  emergenza2_telefono: string | null
  emergenza2_relazione: string | null
  notification_preferences: {
    email_enabled: boolean
    sms_enabled: boolean
    call_enabled: boolean
    quiet_hours_start: string | null
    quiet_hours_end: string | null
    language: string
  } | null
}

/**
 * Mappatura tipo alert -> descrizione
 */
export const ALERT_TYPE_LABELS: Record<string, string> = {
  // Heart Rate
  heart_rate_low_warning: 'Frequenza cardiaca bassa',
  heart_rate_high_warning: 'Frequenza cardiaca alta',
  heart_rate_low_critical: 'Frequenza cardiaca criticamente bassa',
  heart_rate_high_critical: 'Frequenza cardiaca criticamente alta',

  // SpO2
  spo2_low_warning: 'Saturazione ossigeno bassa',
  spo2_low_critical: 'Saturazione ossigeno critica',

  // Blood Pressure
  systolic_bp_low_warning: 'Pressione sistolica bassa',
  systolic_bp_high_warning: 'Pressione sistolica alta',
  systolic_bp_low_critical: 'Pressione sistolica criticamente bassa',
  systolic_bp_high_critical: 'Pressione sistolica criticamente alta',
  diastolic_bp_low_warning: 'Pressione diastolica bassa',
  diastolic_bp_high_warning: 'Pressione diastolica alta',
  diastolic_bp_low_critical: 'Pressione diastolica criticamente bassa',
  diastolic_bp_high_critical: 'Pressione diastolica criticamente alta',

  // Temperature
  temperature_low_warning: 'Temperatura corporea bassa',
  temperature_high_warning: 'Temperatura corporea alta (febbre)',
  temperature_low_critical: 'Ipotermia',
  temperature_high_critical: 'Ipertermia grave',
}

/**
 * Unità di misura per parametro
 */
export const PARAMETER_UNITS: Record<ParameterType, string> = {
  heart_rate: 'bpm',
  spo2: '%',
  systolic_bp: 'mmHg',
  diastolic_bp: 'mmHg',
  temperature: '°C',
}

/**
 * Nomi parametri in italiano
 */
export const PARAMETER_LABELS: Record<ParameterType, string> = {
  heart_rate: 'Frequenza cardiaca',
  spo2: 'Saturazione ossigeno',
  systolic_bp: 'Pressione sistolica',
  diastolic_bp: 'Pressione diastolica',
  temperature: 'Temperatura',
}
