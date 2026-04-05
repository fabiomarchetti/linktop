import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/gps/history/[pazienteId]?days=7
 * Ritorna lo storico posizioni degli ultimi N giorni (default 7)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const limit = parseInt(searchParams.get('limit') || '500')

    const result = await pool.query(
      `SELECT id, lat, lng, accuracy, recorded_at
      FROM linktop_gps_positions
      WHERE paziente_id = $1
        AND recorded_at >= NOW() - INTERVAL '1 day' * $2
      ORDER BY recorded_at DESC
      LIMIT $3`,
      [pazienteId, days, limit]
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
