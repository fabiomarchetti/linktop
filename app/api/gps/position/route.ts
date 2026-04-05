import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * POST /api/gps/position
 * L'app Flutter invia qui la posizione del paziente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      paziente_id,
      lat,
      lng,
      accuracy,
      altitude,
      speed,
      heading,
      battery_level,
      source,
    } = body

    if (!paziente_id || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'paziente_id, lat e lng sono obbligatori' },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `INSERT INTO linktop_gps_positions (
        paziente_id, lat, lng, accuracy, altitude, speed, heading, battery_level, source, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, recorded_at`,
      [
        paziente_id,
        lat,
        lng,
        accuracy || null,
        altitude || null,
        speed || null,
        heading || null,
        battery_level || null,
        source || 'auto',
      ]
    )

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      recorded_at: result.rows[0].recorded_at,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Errore salvataggio GPS:', error)
    return NextResponse.json(
      { success: false, error: 'Errore salvataggio posizione', details: error.message },
      { status: 500 }
    )
  }
}
