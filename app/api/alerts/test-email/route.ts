import { NextRequest, NextResponse } from 'next/server'
import { sendTestNotification } from '@/lib/alerts'

/**
 * POST /api/alerts/test-email
 * Invia un'email di test per verificare la configurazione
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Test Email] Avvio invio email di test...')

    const result = await sendTestNotification()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('[Test Email] Errore:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nell\'invio dell\'email di test',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/alerts/test-email
 * Verifica la configurazione email senza inviare
 */
export async function GET(request: NextRequest) {
  const config = {
    resend_configured: !!process.env.RESEND_API_KEY,
    from_email: process.env.RESEND_FROM_EMAIL || 'non configurato',
    from_name: process.env.RESEND_FROM_NAME || 'non configurato',
    recipient_email: process.env.ALERT_RECIPIENT_EMAIL || 'non configurato',
  }

  return NextResponse.json({
    success: true,
    config,
    ready: config.resend_configured && !!process.env.ALERT_RECIPIENT_EMAIL,
  })
}
