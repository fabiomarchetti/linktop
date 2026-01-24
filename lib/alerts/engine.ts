/**
 * Alert Engine - Motore di Valutazione Regole
 *
 * Valuta i parametri vitali in arrivo e genera alert
 * quando i valori superano le soglie configurate.
 */

import pool from '@/lib/db'
import { getEffectiveThresholds } from './thresholds'
import { dispatchAlertNotifications } from './dispatcher'
import {
  Alert,
  AlertSeverity,
  EvaluationResult,
  HealthMeasurement,
  ParameterType,
  ThresholdConfig,
  PARAMETER_LABELS,
  PARAMETER_UNITS,
} from './types'

/**
 * Valuta un singolo parametro contro le soglie
 */
function evaluateParameter(
  parameterType: ParameterType,
  value: number,
  threshold: ThresholdConfig
): { severity: AlertSeverity; threshold_exceeded: number; direction: 'low' | 'high' } | null {

  // Controlla prima i valori critici (più urgenti)
  if (threshold.min_critical !== null && value < threshold.min_critical) {
    return {
      severity: 'emergency',
      threshold_exceeded: threshold.min_critical,
      direction: 'low',
    }
  }

  if (threshold.max_critical !== null && value > threshold.max_critical) {
    return {
      severity: 'emergency',
      threshold_exceeded: threshold.max_critical,
      direction: 'high',
    }
  }

  // Poi i valori warning
  if (threshold.min_warning !== null && value < threshold.min_warning) {
    return {
      severity: 'warning',
      threshold_exceeded: threshold.min_warning,
      direction: 'low',
    }
  }

  if (threshold.max_warning !== null && value > threshold.max_warning) {
    return {
      severity: 'warning',
      threshold_exceeded: threshold.max_warning,
      direction: 'high',
    }
  }

  // Valore normale
  return null
}

/**
 * Genera il tipo di alert basato su parametro, severità e direzione
 */
function generateAlertType(
  parameterType: ParameterType,
  severity: AlertSeverity,
  direction: 'low' | 'high'
): string {
  const severityLabel = severity === 'emergency' ? 'critical' : 'warning'
  return `${parameterType}_${direction}_${severityLabel}`
}

/**
 * Genera il messaggio descrittivo dell'alert
 */
function generateAlertMessage(
  parameterType: ParameterType,
  value: number,
  thresholdExceeded: number,
  direction: 'low' | 'high',
  severity: AlertSeverity
): string {
  const paramLabel = PARAMETER_LABELS[parameterType]
  const unit = PARAMETER_UNITS[parameterType]
  const directionLabel = direction === 'low' ? 'sotto' : 'sopra'
  const severityLabel = severity === 'emergency' ? 'CRITICO' : 'Attenzione'

  return `${severityLabel}: ${paramLabel} ${directionLabel} la soglia. ` +
         `Valore: ${value}${unit} (soglia: ${thresholdExceeded}${unit})`
}

/**
 * Controlla se esiste già un alert attivo per lo stesso paziente/parametro
 * negli ultimi N minuti (per evitare duplicati)
 */
async function hasRecentActiveAlert(
  pazienteId: number,
  parameterType: ParameterType,
  minutesWindow: number = 15
): Promise<boolean> {
  const result = await pool.query(`
    SELECT id FROM linktop_alerts
    WHERE paziente_id = $1
      AND parameter_type = $2
      AND status IN ('active', 'escalated')
      AND created_at > NOW() - INTERVAL '${minutesWindow} minutes'
    LIMIT 1
  `, [pazienteId, parameterType])

  return result.rows.length > 0
}

/**
 * Salva un nuovo alert nel database
 */
async function saveAlert(alert: Alert): Promise<number> {
  const result = await pool.query(`
    INSERT INTO linktop_alerts (
      paziente_id,
      alert_type,
      severity,
      parameter_type,
      measured_value,
      threshold_exceeded,
      health_data_id,
      message,
      status,
      escalation_level
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `, [
    alert.paziente_id,
    alert.alert_type,
    alert.severity,
    alert.parameter_type,
    alert.measured_value,
    alert.threshold_exceeded,
    alert.health_data_id,
    alert.message,
    alert.status,
    alert.escalation_level,
  ])

  return result.rows[0].id
}

/**
 * Valuta una misurazione e genera alert se necessario
 *
 * Questa è la funzione principale chiamata ad ogni nuova misurazione.
 */
export async function evaluateMeasurement(
  measurement: HealthMeasurement
): Promise<EvaluationResult> {
  const alerts: Alert[] = []
  let measurementsEvaluated = 0

  // Recupera le soglie effettive per questo paziente
  const thresholds = await getEffectiveThresholds(measurement.paziente_id)

  // Parametri da valutare
  const parametersToEvaluate: { type: ParameterType; value: number | null | undefined }[] = [
    { type: 'heart_rate', value: measurement.heart_rate },
    { type: 'spo2', value: measurement.spo2 },
    { type: 'systolic_bp', value: measurement.systolic_bp },
    { type: 'diastolic_bp', value: measurement.diastolic_bp },
    { type: 'temperature', value: measurement.temperature },
  ]

  for (const param of parametersToEvaluate) {
    // Salta valori null/undefined
    if (param.value === null || param.value === undefined) {
      continue
    }

    measurementsEvaluated++

    // Ottieni soglie per questo parametro
    const threshold = thresholds.get(param.type)
    if (!threshold) {
      // Nessuna regola definita per questo parametro
      continue
    }

    // Valuta il parametro
    const evaluation = evaluateParameter(param.type, param.value, threshold)

    if (evaluation) {
      // Controlla se esiste già un alert attivo recente
      const hasRecent = await hasRecentActiveAlert(
        measurement.paziente_id,
        param.type,
        evaluation.severity === 'emergency' ? 5 : 15  // Finestra più breve per emergenze
      )

      if (!hasRecent) {
        // Genera l'alert
        const alertType = generateAlertType(param.type, evaluation.severity, evaluation.direction)
        const message = generateAlertMessage(
          param.type,
          param.value,
          evaluation.threshold_exceeded,
          evaluation.direction,
          evaluation.severity
        )

        const alert: Alert = {
          paziente_id: measurement.paziente_id,
          alert_type: alertType,
          severity: evaluation.severity,
          parameter_type: param.type,
          measured_value: param.value,
          threshold_exceeded: evaluation.threshold_exceeded,
          health_data_id: measurement.health_data_id || null,
          message,
          status: 'active',
          escalation_level: 0,
        }

        // Salva nel database
        const alertId = await saveAlert(alert)
        alert.id = alertId
        alert.created_at = new Date()

        alerts.push(alert)

        console.log(`[Alert Engine] Alert generato: ${alertType} per paziente ${measurement.paziente_id}`)

        // Dispatcha le notifiche (async, non blocca)
        dispatchAlertNotifications(alert).then(result => {
          console.log(`[Alert Engine] Notifiche inviate: ${result.notifications_sent}, fallite: ${result.notifications_failed}`)
        }).catch(err => {
          console.error('[Alert Engine] Errore dispatch notifiche:', err)
        })
      } else {
        console.log(`[Alert Engine] Alert duplicato ignorato: ${param.type} per paziente ${measurement.paziente_id}`)
      }
    }
  }

  return {
    has_alerts: alerts.length > 0,
    alerts,
    measurements_evaluated: measurementsEvaluated,
  }
}

/**
 * Recupera gli alert attivi per un paziente
 */
export async function getActiveAlertsForPatient(pazienteId: number): Promise<Alert[]> {
  const result = await pool.query(`
    SELECT *
    FROM linktop_alerts
    WHERE paziente_id = $1
      AND status IN ('active', 'escalated')
    ORDER BY
      CASE severity
        WHEN 'emergency' THEN 1
        WHEN 'alarm' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'info' THEN 4
      END,
      created_at DESC
  `, [pazienteId])

  return result.rows
}

/**
 * Recupera tutti gli alert attivi (per dashboard)
 */
export async function getAllActiveAlerts(): Promise<(Alert & { nome: string; cognome: string })[]> {
  const result = await pool.query(`
    SELECT
      a.*,
      p.nome,
      p.cognome
    FROM linktop_alerts a
    JOIN linktop_pazienti p ON a.paziente_id = p.id
    WHERE a.status IN ('active', 'escalated')
    ORDER BY
      CASE a.severity
        WHEN 'emergency' THEN 1
        WHEN 'alarm' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'info' THEN 4
      END,
      a.created_at DESC
  `)

  return result.rows
}

/**
 * Aggiorna lo stato di un alert (acknowledge, resolve, etc.)
 */
export async function updateAlertStatus(
  alertId: number,
  status: Alert['status'],
  userId?: number,
  notes?: string
): Promise<void> {
  let query = ''
  const params: any[] = [status, alertId]

  switch (status) {
    case 'acknowledged':
      query = `
        UPDATE linktop_alerts
        SET status = $1, acknowledged_at = NOW(), acknowledged_by = $3
        WHERE id = $2
      `
      params.push(userId || null)
      break

    case 'resolved':
      query = `
        UPDATE linktop_alerts
        SET status = $1, resolved_at = NOW(), resolved_by = $3, resolution_notes = $4
        WHERE id = $2
      `
      params.push(userId || null, notes || null)
      break

    case 'false_positive':
      query = `
        UPDATE linktop_alerts
        SET status = $1, resolved_at = NOW(), resolved_by = $3, resolution_notes = $4
        WHERE id = $2
      `
      params.push(userId || null, notes || 'Marcato come falso positivo')
      break

    default:
      query = `
        UPDATE linktop_alerts
        SET status = $1
        WHERE id = $2
      `
  }

  await pool.query(query, params)
}

/**
 * Conta gli alert attivi raggruppati per severità
 */
export async function getAlertCountsBySeverity(): Promise<Record<AlertSeverity, number>> {
  const result = await pool.query(`
    SELECT severity, COUNT(*) as count
    FROM linktop_alerts
    WHERE status IN ('active', 'escalated')
    GROUP BY severity
  `)

  const counts: Record<AlertSeverity, number> = {
    info: 0,
    warning: 0,
    alarm: 0,
    emergency: 0,
  }

  for (const row of result.rows) {
    counts[row.severity as AlertSeverity] = parseInt(row.count)
  }

  return counts
}
