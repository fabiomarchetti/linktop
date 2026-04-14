import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/health/schedule/[pazienteId]
 * Restituisce l'intervallo di misurazione automatica configurato.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const result = await pool.query(
      'SELECT auto_measure_interval_minutes FROM linktop_pazienti WHERE id = $1',
      [pazienteId]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Paziente non trovato' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      interval_minutes: result.rows[0].auto_measure_interval_minutes ?? null,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * PUT /api/health/schedule/[pazienteId]
 * Imposta o rimuove la pianificazione automatica.
 * Body: { interval_minutes: number | null }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const body = await request.json()
    const { interval_minutes } = body

    const valid = [null, 5, 15, 30, 60, 120, 300, 720, 1440]
    if (!valid.includes(interval_minutes)) {
      return NextResponse.json(
        { success: false, error: 'Intervallo non valido' },
        { status: 400 }
      )
    }

    await pool.query(
      'UPDATE linktop_pazienti SET auto_measure_interval_minutes = $1 WHERE id = $2',
      [interval_minutes, pazienteId]
    )

    return NextResponse.json({ success: true, interval_minutes })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
