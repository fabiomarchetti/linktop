import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getAllActiveAlerts, getAlertCountsBySeverity, updateAlertStatus } from '@/lib/alerts'

/**
 * GET /api/alerts
 * Recupera gli alert con filtri opzionali
 *
 * Query params:
 * - status: 'active' | 'acknowledged' | 'resolved' | 'all' (default: 'active')
 * - severity: 'emergency' | 'alarm' | 'warning' | 'info' | 'all' (default: 'all')
 * - paziente_id: filtra per paziente specifico
 * - limit: numero massimo di risultati (default: 100)
 * - include_counts: 'true' per includere conteggi per severità
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const severity = searchParams.get('severity') || 'all'
    const pazienteId = searchParams.get('paziente_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    const includeCounts = searchParams.get('include_counts') === 'true'

    // Costruisci query dinamicamente
    let query = `
      SELECT
        a.id,
        a.paziente_id,
        a.alert_type,
        a.severity,
        a.parameter_type,
        a.measured_value,
        a.threshold_exceeded,
        a.message,
        a.status,
        a.escalation_level,
        a.acknowledged_at,
        a.acknowledged_by,
        a.resolved_at,
        a.resolved_by,
        a.resolution_notes,
        a.created_at,
        p.nome,
        p.cognome,
        p.codice_fiscale,
        u_ack.username as acknowledged_by_username,
        u_res.username as resolved_by_username
      FROM linktop_alerts a
      JOIN linktop_pazienti p ON a.paziente_id = p.id
      LEFT JOIN linktop_users u_ack ON a.acknowledged_by = u_ack.id
      LEFT JOIN linktop_users u_res ON a.resolved_by = u_res.id
      WHERE 1=1
    `

    const params: any[] = []
    let paramCount = 1

    // Filtro status
    if (status !== 'all') {
      if (status === 'active') {
        query += ` AND a.status IN ('active', 'escalated')`
      } else {
        query += ` AND a.status = $${paramCount}`
        params.push(status)
        paramCount++
      }
    }

    // Filtro severity
    if (severity !== 'all') {
      query += ` AND a.severity = $${paramCount}`
      params.push(severity)
      paramCount++
    }

    // Filtro paziente
    if (pazienteId) {
      query += ` AND a.paziente_id = $${paramCount}`
      params.push(parseInt(pazienteId))
      paramCount++
    }

    // Ordinamento e limite
    query += `
      ORDER BY
        CASE a.severity
          WHEN 'emergency' THEN 1
          WHEN 'alarm' THEN 2
          WHEN 'warning' THEN 3
          WHEN 'info' THEN 4
        END,
        a.created_at DESC
      LIMIT $${paramCount}
    `
    params.push(limit)

    const result = await pool.query(query, params)

    // Opzionalmente includi conteggi
    let counts = null
    if (includeCounts) {
      counts = await getAlertCountsBySeverity()
    }

    return NextResponse.json({
      success: true,
      alerts: result.rows,
      total: result.rows.length,
      counts,
    })

  } catch (error: any) {
    console.error('Errore GET /api/alerts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel recupero degli alert',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/alerts
 * Aggiorna lo stato di un alert (acknowledge, resolve, etc.)
 *
 * Body:
 * - alert_id: ID dell'alert
 * - action: 'acknowledge' | 'resolve' | 'false_positive' | 'escalate'
 * - user_id: ID dell'utente che esegue l'azione
 * - notes: note opzionali (per resolve/false_positive)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { alert_id, action, user_id, notes } = body

    if (!alert_id || !action) {
      return NextResponse.json(
        { error: 'alert_id e action sono richiesti' },
        { status: 400 }
      )
    }

    let newStatus: string

    switch (action) {
      case 'acknowledge':
        newStatus = 'acknowledged'
        break
      case 'resolve':
        newStatus = 'resolved'
        break
      case 'false_positive':
        newStatus = 'false_positive'
        break
      case 'escalate':
        newStatus = 'escalated'
        break
      default:
        return NextResponse.json(
          { error: `Azione non valida: ${action}` },
          { status: 400 }
        )
    }

    await updateAlertStatus(alert_id, newStatus as any, user_id, notes)

    // Recupera l'alert aggiornato
    const result = await pool.query(`
      SELECT a.*, p.nome, p.cognome
      FROM linktop_alerts a
      JOIN linktop_pazienti p ON a.paziente_id = p.id
      WHERE a.id = $1
    `, [alert_id])

    return NextResponse.json({
      success: true,
      alert: result.rows[0],
      message: `Alert ${action === 'acknowledge' ? 'preso in carico' : action === 'resolve' ? 'risolto' : action === 'false_positive' ? 'marcato come falso positivo' : 'escalato'}`,
    })

  } catch (error: any) {
    console.error('Errore PATCH /api/alerts:', error)
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
