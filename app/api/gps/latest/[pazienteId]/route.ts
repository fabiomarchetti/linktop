import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/gps/latest/[pazienteId]
 * Ritorna l'ultima posizione del paziente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params

    const result = await pool.query(
      `SELECT id, lat, lng, accuracy, altitude, speed, heading, battery_level, source, recorded_at
      FROM linktop_gps_positions
      WHERE paziente_id = $1
      ORDER BY recorded_at DESC
      LIMIT 1`,
      [pazienteId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error: any) {
    console.error('Errore GPS latest:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
