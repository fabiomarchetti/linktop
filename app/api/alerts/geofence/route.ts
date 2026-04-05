import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const FROM_NAME = process.env.RESEND_FROM_NAME || 'LINKTOP Alert System'

/**
 * POST /api/alerts/geofence
 * Chiamato dall'app Flutter quando il paziente esce/entra in una zona.
 * Invia email ai contatti di emergenza configurati nel paziente,
 * filtrati in base al campo notify_contacts della zona.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paziente_id, geofence_id, event_type, lat, lng } = body

    if (!paziente_id || !geofence_id || !event_type) {
      return NextResponse.json(
        { success: false, error: 'paziente_id, geofence_id, event_type richiesti' },
        { status: 400 }
      )
    }

    // Carica info paziente (contatti emergenza) + zona
    const info = await pool.query(
      `SELECT
        p.nome, p.cognome,
        p.emergenza_nome, p.emergenza_telefono, p.emergenza_email, p.emergenza_relazione,
        p.emergenza2_nome, p.emergenza2_telefono, p.emergenza2_email, p.emergenza2_relazione,
        g.name as zone_name, g.notify_contacts, g.notify_on_exit, g.notify_on_enter
       FROM linktop_pazienti p, linktop_geofences g
       WHERE p.id = $1 AND g.id = $2`,
      [paziente_id, geofence_id]
    )

    if (info.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Paziente o zona non trovati' }, { status: 404 })
    }

    const row = info.rows[0]
    const { nome, cognome, zone_name, notify_contacts, notify_on_exit, notify_on_enter } = row

    // Controlla se la zona e' configurata per notificare questo evento
    if (event_type === 'exit' && !notify_on_exit) {
      return NextResponse.json({ success: true, notified: 0, reason: 'notify_on_exit disabilitato' })
    }
    if (event_type === 'enter' && !notify_on_enter) {
      return NextResponse.json({ success: true, notified: 0, reason: 'notify_on_enter disabilitato' })
    }
    if (notify_contacts === 'none') {
      return NextResponse.json({ success: true, notified: 0, reason: 'notify_contacts=none' })
    }

    // Salva evento geofence
    await pool.query(
      `INSERT INTO linktop_geofence_events (paziente_id, geofence_id, event_type, lat, lng)
       VALUES ($1, $2, $3, $4, $5)`,
      [paziente_id, geofence_id, event_type, lat || 0, lng || 0]
    )

    // Determina lista contatti da notificare
    const contactsToNotify: Array<{ nome: string; email: string; telefono: string | null; relazione: string | null }> = []
    const includeFirst = notify_contacts === 'emergenza' || notify_contacts === 'both' || !notify_contacts
    const includeSecond = notify_contacts === 'emergenza2' || notify_contacts === 'both'

    if (includeFirst && row.emergenza_email) {
      contactsToNotify.push({
        nome: row.emergenza_nome || 'Contatto 1',
        email: row.emergenza_email,
        telefono: row.emergenza_telefono,
        relazione: row.emergenza_relazione,
      })
    }
    if (includeSecond && row.emergenza2_email) {
      contactsToNotify.push({
        nome: row.emergenza2_nome || 'Contatto 2',
        email: row.emergenza2_email,
        telefono: row.emergenza2_telefono,
        relazione: row.emergenza2_relazione,
      })
    }

    if (contactsToNotify.length === 0) {
      return NextResponse.json({ success: true, notified: 0, reason: 'nessuna email emergenza configurata' })
    }

    const now = new Date().toLocaleString('it-IT')
    const eventLabel = event_type === 'exit' ? 'USCITO DALLA ZONA' : 'ENTRATO NELLA ZONA'
    const actionWord = event_type === 'exit' ? 'ha lasciato' : "e' entrato in"

    const mapLink = lat && lng
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17`
      : ''

    let sent = 0
    const errors: string[] = []

    for (const c of contactsToNotify) {
      const callButton = c.telefono
        ? `<a href="tel:${c.telefono}" style="display:inline-block;background:#16a34a;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:8px 4px;">📞 CHIAMA ${nome.toUpperCase()}</a>`
        : ''

      const mapButton = mapLink
        ? `<a href="${mapLink}" style="display:inline-block;background:#2563eb;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:8px 4px;">🗺️ VEDI POSIZIONE</a>`
        : ''

      const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#f3f4f6; margin:0; padding:20px;">
        <div style="max-width:600px; margin:0 auto; background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding:24px; text-align:center;">
            <h1 style="color:white; margin:0; font-size:24px;">⚠️ Avviso Supervisione</h1>
            <p style="color:white; margin:8px 0 0; opacity:0.9; font-size:14px;">Monitoraggio Salute</p>
          </div>
          <div style="padding:24px;">
            <p style="font-size:16px; color:#333; margin:0 0 12px;">
              Ciao <strong>${c.nome}</strong>,
            </p>
            <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:16px; border-radius:4px; margin:16px 0;">
              <p style="margin:0; font-size:18px; color:#92400e;">
                <strong>${nome} ${cognome}</strong> ${actionWord} la zona <strong>"${zone_name}"</strong>
              </p>
              <p style="margin:8px 0 0; color:#92400e; font-size:14px;">
                ${eventLabel} &middot; ${now}
              </p>
            </div>
            <p style="font-size:14px; color:#666; margin:16px 0;">
              Puoi verificare la situazione con i pulsanti qui sotto:
            </p>
            <div style="text-align:center; margin:24px 0;">
              ${callButton}
              ${mapButton}
            </div>
            <div style="border-top:1px solid #e5e7eb; margin-top:24px; padding-top:16px; font-size:12px; color:#9ca3af; text-align:center;">
              <p style="margin:0;">Messaggio automatico - LINKTOP Monitoraggio Salute</p>
              <p style="margin:4px 0 0;">
                <a href="https://www.monitoraggiosalute.com/supervisione" style="color:#6b7280;">Accedi al portale</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `

      try {
        const { error } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [c.email],
          subject: `⚠️ ${nome} ${cognome} ${actionWord} ${zone_name}`,
          html,
        })
        if (error) {
          errors.push(`${c.email}: ${error.message}`)
        } else {
          sent++
        }
      } catch (e: any) {
        errors.push(`${c.email}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      notified: sent,
      total_contacts: contactsToNotify.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[alerts/geofence] errore:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
