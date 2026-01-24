import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { updateAlertStatus } from '@/lib/alerts'

/**
 * GET /api/alerts/[id]
 * Recupera un singolo alert con tutti i dettagli
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const alertId = parseInt(id)

    if (isNaN(alertId)) {
      return NextResponse.json(
        { error: 'ID alert non valido' },
        { status: 400 }
      )
    }

    // Recupera alert con dettagli paziente e notifiche
    const alertResult = await pool.query(`
      SELECT
        a.*,
        p.nome,
        p.cognome,
        p.codice_fiscale,
        p.telefono as paziente_telefono,
        p.email as paziente_email,
        p.emergenza_nome,
        p.emergenza_telefono,
        p.emergenza_relazione,
        u_ack.username as acknowledged_by_username,
        u_ack.nome as acknowledged_by_nome,
        u_ack.cognome as acknowledged_by_cognome,
        u_res.username as resolved_by_username,
        u_res.nome as resolved_by_nome,
        u_res.cognome as resolved_by_cognome
      FROM linktop_alerts a
      JOIN linktop_pazienti p ON a.paziente_id = p.id
      LEFT JOIN linktop_users u_ack ON a.acknowledged_by = u_ack.id
      LEFT JOIN linktop_users u_res ON a.resolved_by = u_res.id
      WHERE a.id = $1
    `, [alertId])

    if (alertResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Alert non trovato' },
        { status: 404 }
      )
    }

    const alert = alertResult.rows[0]

    // Recupera le notifiche associate
    const notificationsResult = await pool.query(`
      SELECT *
      FROM linktop_notifications
      WHERE alert_id = $1
      ORDER BY created_at DESC
    `, [alertId])

    // Recupera la misurazione originale se disponibile
    let healthData = null
    if (alert.health_data_id) {
      const healthDataResult = await pool.query(`
        SELECT *
        FROM linktop_health_data
        WHERE id = $1
      `, [alert.health_data_id])

      if (healthDataResult.rows.length > 0) {
        healthData = healthDataResult.rows[0]
      }
    }

    return NextResponse.json({
      success: true,
      alert: {
        ...alert,
        notifications: notificationsResult.rows,
        health_data: healthData,
      },
    })

  } catch (error: any) {
    console.error('Errore GET /api/alerts/[id]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel recupero dell\'alert',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/alerts/[id]
 * Aggiorna lo stato di un alert specifico
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const alertId = parseInt(id)
    const body = await request.json()

    if (isNaN(alertId)) {
      return NextResponse.json(
        { error: 'ID alert non valido' },
        { status: 400 }
      )
    }

    const { status, user_id, notes } = body

    if (!status) {
      return NextResponse.json(
        { error: 'status richiesto' },
        { status: 400 }
      )
    }

    const validStatuses = ['active', 'acknowledged', 'resolved', 'false_positive', 'escalated']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status non valido. Valori ammessi: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    await updateAlertStatus(alertId, status, user_id, notes)

    // Recupera l'alert aggiornato
    const result = await pool.query(`
      SELECT a.*, p.nome, p.cognome
      FROM linktop_alerts a
      JOIN linktop_pazienti p ON a.paziente_id = p.id
      WHERE a.id = $1
    `, [alertId])

    return NextResponse.json({
      success: true,
      alert: result.rows[0],
    })

  } catch (error: any) {
    console.error('Errore PUT /api/alerts/[id]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nell\'aggiornamento dell\'alert',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/alerts/[id]
 * Elimina un alert (solo per admin/sviluppatore)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const alertId = parseInt(id)

    if (isNaN(alertId)) {
      return NextResponse.json(
        { error: 'ID alert non valido' },
        { status: 400 }
      )
    }

    // Prima elimina le notifiche associate
    await pool.query(`
      DELETE FROM linktop_notifications
      WHERE alert_id = $1
    `, [alertId])

    // Poi elimina l'alert
    const result = await pool.query(`
      DELETE FROM linktop_alerts
      WHERE id = $1
      RETURNING id
    `, [alertId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Alert non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Alert eliminato con successo',
    })

  } catch (error: any) {
    console.error('Errore DELETE /api/alerts/[id]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nell\'eliminazione dell\'alert',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
