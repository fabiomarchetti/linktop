import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/gps/history/[pazienteId]?days=7 oppure ?hours=5
 * Ritorna lo storico posizioni (priorita' a hours se presente)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const { searchParams } = new URL(request.url)
    const hours = searchParams.get('hours')
    const days = searchParams.get('days')
    const limit = parseInt(searchParams.get('limit') || '1000')

    let interval: string
    if (hours) {
      interval = `${parseInt(hours)} hours`
    } else {
      interval = `${parseInt(days || '7')} days`
    }

    const result = await pool.query(
      `SELECT id, lat, lng, accuracy, recorded_at
      FROM linktop_gps_positions
      WHERE paziente_id = $1
        AND recorded_at >= NOW() - INTERVAL '${interval}'
      ORDER BY recorded_at DESC
      LIMIT $2`,
      [pazienteId, limit]
    )

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    })
  } catch (error: any) {
    console.error('Errore GPS history:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
