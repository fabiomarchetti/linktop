/**
 * Alert Dispatcher
 *
 * Gestisce l'invio delle notifiche per gli alert generati.
 * Determina i destinatari, invia le notifiche e traccia lo stato.
 */

import pool from '@/lib/db'
import { sendAlertEmail, isEmailConfigured } from '@/lib/notifications/email'
import { AlertEmailData } from '@/lib/notifications/templates'
import {
  Alert,
  NotificationChannel,
  NotificationStatus,
  RecipientType,
  PatientNotificationData,
} from './types'

/**
 * Record notifica da salvare
 */
interface NotificationRecord {
  alert_id: number
  recipient_type: RecipientType
  recipient_id: number | null
  recipient_name: string | null
  recipient_contact: string
  channel: NotificationChannel
  message_subject: string | null
  message_content: string | null
  status: NotificationStatus
  provider: string | null
  provider_message_id: string | null
  error_message: string | null
}

/**
 * Recupera i dati del paziente per le notifiche
 */
async function getPatientNotificationData(pazienteId: number): Promise<PatientNotificationData | null> {
  const result = await pool.query(`
    SELECT
      id,
      nome,
      cognome,
      email,
      telefono,
      emergenza_nome,
      emergenza_telefono,
      emergenza_relazione,
      emergenza2_nome,
      emergenza2_telefono,
      emergenza2_relazione,
      notification_preferences
    FROM linktop_pazienti
    WHERE id = $1
  `, [pazienteId])

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0]
}

/**
 * Salva un record di notifica nel database
 */
async function saveNotification(notification: NotificationRecord): Promise<number> {
  const result = await pool.query(`
    INSERT INTO linktop_notifications (
      alert_id,
      recipient_type,
      recipient_id,
      recipient_name,
      recipient_contact,
      channel,
      message_subject,
      message_content,
      status,
      provider,
      provider_message_id,
      error_message,
      sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${notification.status === 'sent' ? 'NOW()' : 'NULL'})
    RETURNING id
  `, [
    notification.alert_id,
    notification.recipient_type,
    notification.recipient_id,
    notification.recipient_name,
    notification.recipient_contact,
    notification.channel,
    notification.message_subject,
    notification.message_content,
    notification.status,
    notification.provider,
    notification.provider_message_id,
    notification.error_message,
  ])

  return result.rows[0].id
}

/**
 * Aggiorna lo stato di una notifica
 */
async function updateNotificationStatus(
  notificationId: number,
  status: NotificationStatus,
  messageId?: string,
  errorMessage?: string
): Promise<void> {
  let updateFields = 'status = $2'
  const params: any[] = [notificationId, status]
  let paramCount = 3

  if (status === 'sent' || status === 'delivered') {
    updateFields += `, sent_at = COALESCE(sent_at, NOW())`
  }

  if (status === 'delivered') {
    updateFields += `, delivered_at = NOW()`
  }

  if (status === 'failed') {
    updateFields += `, failed_at = NOW()`
  }

  if (messageId) {
    updateFields += `, provider_message_id = $${paramCount}`
    params.push(messageId)
    paramCount++
  }

  if (errorMessage) {
    updateFields += `, error_message = $${paramCount}`
    params.push(errorMessage)
    paramCount++
  }

  await pool.query(`
    UPDATE linktop_notifications
    SET ${updateFields}
    WHERE id = $1
  `, params)
}

/**
 * Determina i destinatari email in base alla severità
 */
function getEmailRecipients(
  severity: Alert['severity'],
  patient: PatientNotificationData
): { type: RecipientType; email: string; name: string | null }[] {
  const recipients: { type: RecipientType; email: string; name: string | null }[] = []

  // Destinatario principale configurato (staff)
  const alertRecipient = process.env.ALERT_RECIPIENT_EMAIL
  if (alertRecipient) {
    recipients.push({
      type: 'staff',
      email: alertRecipient,
      name: 'Staff Control Room',
    })
  }

  // Per severità alta, aggiungi anche i contatti di emergenza (se hanno email)
  // Nota: i contatti emergenza hanno solo telefono, non email
  // Quando avrai SMS, li aggiungerai qui

  return recipients
}

/**
 * Dispatcha le notifiche per un alert
 *
 * Questa è la funzione principale chiamata dopo la creazione di un alert.
 */
export async function dispatchAlertNotifications(alert: Alert): Promise<{
  notifications_sent: number
  notifications_failed: number
}> {
  let sent = 0
  let failed = 0

  // Verifica che email sia configurata
  if (!isEmailConfigured()) {
    console.log('[Dispatcher] Email non configurata, skip notifiche')
    return { notifications_sent: 0, notifications_failed: 0 }
  }

  // Recupera dati paziente
  const patient = await getPatientNotificationData(alert.paziente_id)
  if (!patient) {
    console.error(`[Dispatcher] Paziente ${alert.paziente_id} non trovato`)
    return { notifications_sent: 0, notifications_failed: 0 }
  }

  // Determina destinatari email
  const emailRecipients = getEmailRecipients(alert.severity, patient)

  // Prepara dati per template email
  const emailData: AlertEmailData = {
    patientName: `${patient.nome} ${patient.cognome}`,
    patientId: patient.id,
    severity: alert.severity,
    alertType: alert.alert_type,
    parameterType: alert.parameter_type,
    measuredValue: alert.measured_value,
    thresholdExceeded: alert.threshold_exceeded,
    message: alert.message,
    alertId: alert.id!,
    timestamp: alert.created_at || new Date(),
    dashboardUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://linktop.vercel.app',
  }

  // Invia email a ogni destinatario
  for (const recipient of emailRecipients) {
    console.log(`[Dispatcher] Invio email a ${recipient.email}...`)

    // Crea record notifica (pending)
    const notificationId = await saveNotification({
      alert_id: alert.id!,
      recipient_type: recipient.type,
      recipient_id: null,
      recipient_name: recipient.name,
      recipient_contact: recipient.email,
      channel: 'email',
      message_subject: null,  // Generato dal template
      message_content: null,  // Generato dal template
      status: 'pending',
      provider: 'resend',
      provider_message_id: null,
      error_message: null,
    })

    // Invia email
    const result = await sendAlertEmail(recipient.email, emailData)

    // Aggiorna stato notifica
    if (result.success) {
      await updateNotificationStatus(notificationId, 'sent', result.messageId)
      sent++
      console.log(`[Dispatcher] Email inviata a ${recipient.email}`)
    } else {
      await updateNotificationStatus(notificationId, 'failed', undefined, result.error)
      failed++
      console.error(`[Dispatcher] Errore invio email a ${recipient.email}: ${result.error}`)
    }
  }

  // Log notifica dashboard (sempre)
  await saveNotification({
    alert_id: alert.id!,
    recipient_type: 'staff',
    recipient_id: null,
    recipient_name: 'Dashboard',
    recipient_contact: 'dashboard',
    channel: 'dashboard',
    message_subject: alert.alert_type,
    message_content: alert.message,
    status: 'sent',
    provider: 'internal',
    provider_message_id: null,
    error_message: null,
  })

  return {
    notifications_sent: sent,
    notifications_failed: failed,
  }
}

/**
 * Invia una notifica di test
 */
export async function sendTestNotification(): Promise<{
  success: boolean
  message: string
}> {
  const testEmail = process.env.ALERT_RECIPIENT_EMAIL

  if (!testEmail) {
    return {
      success: false,
      message: 'ALERT_RECIPIENT_EMAIL non configurato',
    }
  }

  if (!isEmailConfigured()) {
    return {
      success: false,
      message: 'RESEND_API_KEY non configurata',
    }
  }

  const { sendTestEmail } = await import('@/lib/notifications/email')
  const result = await sendTestEmail(testEmail)

  return {
    success: result.success,
    message: result.success
      ? `Email di test inviata a ${testEmail}`
      : `Errore: ${result.error}`,
  }
}
