/**
 * Template Email per Alert LINKTOP
 *
 * Template HTML elaborati e visivamente gradevoli
 * per le notifiche di alert sanitari.
 */

import { AlertSeverity, ParameterType, PARAMETER_LABELS, PARAMETER_UNITS } from '@/lib/alerts/types'

/**
 * Colori per severità
 */
const SEVERITY_COLORS: Record<AlertSeverity, { bg: string; text: string; border: string; icon: string }> = {
  emergency: {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#EF4444',
    icon: '🚨',
  },
  alarm: {
    bg: '#FED7AA',
    text: '#9A3412',
    border: '#F97316',
    icon: '⚠️',
  },
  warning: {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#F59E0B',
    icon: '⚡',
  },
  info: {
    bg: '#DBEAFE',
    text: '#1E40AF',
    border: '#3B82F6',
    icon: 'ℹ️',
  },
}

/**
 * Label severità in italiano
 */
const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  emergency: 'EMERGENZA',
  alarm: 'ALLARME',
  warning: 'ATTENZIONE',
  info: 'INFORMAZIONE',
}

/**
 * Interfaccia dati per template email
 */
export interface AlertEmailData {
  patientName: string
  patientId: number
  severity: AlertSeverity
  alertType: string
  parameterType: ParameterType
  measuredValue: number
  thresholdExceeded: number | null
  message: string
  alertId: number
  timestamp: Date
  dashboardUrl?: string
}

/**
 * Genera il template HTML per un alert email
 */
export function generateAlertEmailHtml(data: AlertEmailData): string {
  const colors = SEVERITY_COLORS[data.severity]
  const severityLabel = SEVERITY_LABELS[data.severity]
  const paramLabel = PARAMETER_LABELS[data.parameterType]
  const unit = PARAMETER_UNITS[data.parameterType]
  const formattedTime = formatDateTime(data.timestamp)
  const dashboardUrl = data.dashboardUrl || 'https://linktop.vercel.app/dashboard'

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alert LINKTOP - ${severityLabel}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F3F4F6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header con logo e severità -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); border-radius: 12px 12px 0 0;">
                <tr>
                  <td style="padding: 24px 32px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td>
                          <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 700;">
                            LINKTOP
                          </h1>
                          <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                            Sistema di Monitoraggio Sanitario
                          </p>
                        </td>
                        <td align="right">
                          <span style="font-size: 32px;">${colors.icon}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Badge severità -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: ${colors.text}; font-size: 18px; font-weight: 700;">
                      ${colors.icon} ${severityLabel}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenuto principale -->
          <tr>
            <td style="padding: 24px 32px;">
              <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 600;">
                Alert per ${data.patientName}
              </h2>
              <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 14px;">
                ID Paziente: #${data.patientId} &bull; ${formattedTime}
              </p>

              <!-- Box parametro -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F9FAFB; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="width: 50%;">
                          <p style="margin: 0 0 4px 0; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                            Parametro
                          </p>
                          <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">
                            ${paramLabel}
                          </p>
                        </td>
                        <td style="width: 50%;" align="right">
                          <p style="margin: 0 0 4px 0; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                            Valore Rilevato
                          </p>
                          <p style="margin: 0; color: ${colors.text}; font-size: 24px; font-weight: 700;">
                            ${data.measuredValue}${unit}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${data.thresholdExceeded ? `
                <tr>
                  <td style="padding: 0 20px 20px 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse; border-top: 1px solid #E5E7EB;">
                      <tr>
                        <td style="padding-top: 16px;">
                          <p style="margin: 0; color: #6B7280; font-size: 14px;">
                            Soglia superata: <strong style="color: #111827;">${data.thresholdExceeded}${unit}</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Messaggio -->
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                ${data.message}
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}/statistiche?paziente_id=${data.patientId}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #FFFFFF; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Vedi Statistiche Paziente
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Azioni rapide -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F9FAFB; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600;">
                      Azioni Rapide:
                    </p>
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 16px;">
                          <a href="${dashboardUrl}/pazienti?id=${data.patientId}" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                            Scheda Paziente
                          </a>
                        </td>
                        <td style="padding-right: 16px;">
                          <a href="${dashboardUrl}/alerts/${data.alertId}" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                            Dettagli Alert
                          </a>
                        </td>
                        <td>
                          <a href="${dashboardUrl}/statistiche?paziente_id=${data.patientId}" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                            Storico Misurazioni
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #F9FAFB; border-radius: 0 0 12px 12px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 12px;">
                      Questo messaggio è stato generato automaticamente dal sistema LINKTOP.
                    </p>
                    <p style="margin: 0; color: #9CA3AF; font-size: 11px;">
                      Alert ID: #${data.alertId} &bull; ${formattedTime}
                    </p>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <p style="margin: 0; color: #0D9488; font-size: 14px; font-weight: 600;">
                      LINKTOP
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Genera il subject dell'email basato sulla severità
 */
export function generateAlertEmailSubject(data: AlertEmailData): string {
  const severityLabel = SEVERITY_LABELS[data.severity]
  const paramLabel = PARAMETER_LABELS[data.parameterType]

  switch (data.severity) {
    case 'emergency':
      return `🚨 EMERGENZA: ${paramLabel} critico - ${data.patientName}`
    case 'alarm':
      return `⚠️ ALLARME: ${paramLabel} anomalo - ${data.patientName}`
    case 'warning':
      return `⚡ Attenzione: ${paramLabel} fuori range - ${data.patientName}`
    default:
      return `ℹ️ Info: ${paramLabel} - ${data.patientName}`
  }
}

/**
 * Formatta data e ora in italiano
 */
function formatDateTime(date: Date): string {
  const d = new Date(date)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')

  return `${day}/${month}/${year} alle ${hours}:${minutes}`
}

/**
 * Template per email di test
 */
export function generateTestEmailHtml(): string {
  return generateAlertEmailHtml({
    patientName: 'Mario Rossi',
    patientId: 123,
    severity: 'warning',
    alertType: 'heart_rate_high_warning',
    parameterType: 'heart_rate',
    measuredValue: 115,
    thresholdExceeded: 105,
    message: 'Attenzione: Frequenza cardiaca sopra la soglia. Valore: 115bpm (soglia: 105bpm). Si consiglia di verificare lo stato del paziente.',
    alertId: 1,
    timestamp: new Date(),
    dashboardUrl: 'https://linktop.vercel.app/dashboard',
  })
}
