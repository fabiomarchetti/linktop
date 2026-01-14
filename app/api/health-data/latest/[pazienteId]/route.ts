import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/health-data/latest/[pazienteId]
 * Recupera gli ultimi dati health per un paziente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params

    // Query per recuperare gli ultimi valori dei parametri vitali
    const result = await pool.query(
      `SELECT
        last_heart_rate as heart_rate,
        last_systolic_bp as systolic_bp,
        last_diastolic_bp as diastolic_bp,
        last_spo2 as spo2,
        last_temperature as temperature,
        GREATEST(
          last_heart_rate_time,
          last_bp_time,
          last_spo2_time,
          last_temperature_time
        ) as timestamp
      FROM linktop_pazienti
      WHERE id = $1 AND active = true`,
      [pazienteId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Paziente non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error: any) {
    console.error('❌ Errore recupero dati health:', error)
    return NextResponse.json(
      { success: false, error: 'Errore recupero dati', details: error.message },
      { status: 500 }
    )
  }
}
