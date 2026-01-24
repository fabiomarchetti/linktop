/**
 * Integrazione Resend per invio Email
 *
 * Gestisce l'invio di email transazionali per gli alert sanitari.
 */

import { Resend } from 'resend'
import {
  AlertEmailData,
  generateAlertEmailHtml,
  generateAlertEmailSubject,
} from './templates'

// Inizializza client Resend
const resend = new Resend(process.env.RESEND_API_KEY)

// Configurazione mittente
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const FROM_NAME = process.env.RESEND_FROM_NAME || 'LINKTOP Alert System'

/**
 * Risultato invio email
 */
export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Invia un'email di alert
 */
export async function sendAlertEmail(
  to: string,
  alertData: AlertEmailData
): Promise<EmailResult> {
  try {
    const subject = generateAlertEmailSubject(alertData)
    const html = generateAlertEmailHtml(alertData)

    console.log(`[Email] Invio alert email a ${to}...`)

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('[Email] Errore invio:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    console.log(`[Email] Email inviata con successo. ID: ${data?.id}`)

    return {
      success: true,
      messageId: data?.id,
    }

  } catch (error: any) {
    console.error('[Email] Errore invio:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    }
  }
}

/**
 * Invia un'email di test
 */
export async function sendTestEmail(to: string): Promise<EmailResult> {
  try {
    console.log(`[Email] Invio email di test a ${to}...`)

    const testData: AlertEmailData = {
      patientName: 'Mario Rossi (TEST)',
      patientId: 0,
      severity: 'warning',
      alertType: 'test_alert',
      parameterType: 'heart_rate',
      measuredValue: 115,
      thresholdExceeded: 105,
      message: 'Questa è un\'email di test del sistema LINKTOP Alert. Se ricevi questo messaggio, il sistema di notifiche funziona correttamente.',
      alertId: 0,
      timestamp: new Date(),
      dashboardUrl: 'https://linktop.vercel.app/dashboard',
    }

    return await sendAlertEmail(to, testData)

  } catch (error: any) {
    console.error('[Email] Errore invio test:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    }
  }
}

/**
 * Invia email a più destinatari
 */
export async function sendAlertEmailToMultiple(
  recipients: string[],
  alertData: AlertEmailData
): Promise<{ sent: number; failed: number; results: EmailResult[] }> {
  const results: EmailResult[] = []
  let sent = 0
  let failed = 0

  for (const to of recipients) {
    const result = await sendAlertEmail(to, alertData)
    results.push(result)

    if (result.success) {
      sent++
    } else {
      failed++
    }
  }

  return { sent, failed, results }
}

/**
 * Verifica se il servizio email è configurato
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}
